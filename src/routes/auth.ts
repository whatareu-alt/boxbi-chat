import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import type { Bindings } from '../types';
import {
    MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, MAX_OTP_ATTEMPTS, OTP_RESEND_COOLDOWN_MS,
    ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_DAYS, MAX_DEVICES,
} from '../types';
import {
    hashPassword, verifyPassword, timingSafeEqual,
    generateOtp, generateRefreshToken, hashRefreshToken,
} from '../lib/crypto'; // generateOtp still used by password reset
import { sendEmail, otpEmailHtml } from '../lib/email';
import { safeUser, getAuthUser, requireAuth } from '../lib/util';

const auth = new Hono<{ Bindings: Bindings }>();

// ─── Signup (direct — email OTP verification planned, see README roadmap) ─────

auth.post('/signup', async (c) => {
    const { username, email, firstName, lastName, secret } = await c.req.json();
    if (!username || !secret || !email) return c.json({ error: 'Username, email and password are required' }, 400);
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return c.json({ error: 'Username: 3-30 chars, letters/numbers/underscore only' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email address' }, 400);
    if (secret.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

    try {
        const existing = await c.env.DB.prepare(
            'SELECT id FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?'
        ).bind(username.toLowerCase(), email.toLowerCase()).first();
        if (existing) return c.json({ error: 'Username or email already exists' }, 409);

        const hashed = await hashPassword(secret);
        await c.env.DB.prepare(
            'INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES (?,?,?,?,?)'
        ).bind(username, email.toLowerCase(), hashed, (firstName || '').trim(), (lastName || '').trim()).run();

        const newUser = await c.env.DB.prepare(
            'SELECT id,username,email,first_name,last_name,created_at FROM users WHERE username=?'
        ).bind(username).first();
        return c.json(newUser, 201);
    } catch { return c.json({ error: 'Internal server error' }, 500); }
});

// ─── Password reset ───────────────────────────────────────────────────────────

auth.post('/password-reset/request', async (c) => {
    try {
        const { email } = await c.req.json();
        if (!email?.trim()) return c.json({ error: 'Email is required' }, 400);
        const trimmed = email.trim().toLowerCase();

        const user = await c.env.DB.prepare('SELECT id FROM users WHERE LOWER(email)=?').bind(trimmed).first();
        if (user) {
            // Cooldown — max one reset email per minute per address
            const recent = await c.env.DB.prepare('SELECT created_at FROM password_reset_otps WHERE email=?').bind(trimmed).first() as any;
            if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < OTP_RESEND_COOLDOWN_MS)
                return c.json({ message: 'If an account with that email exists, a reset code has been sent.' }, 200);

            const otp = generateOtp();
            const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            await c.env.DB.prepare('DELETE FROM password_reset_otps WHERE email=?').bind(trimmed).run();
            await c.env.DB.prepare('INSERT INTO password_reset_otps (email, otp, expiry_time, attempts, created_at) VALUES (?,?,?,0,?)')
                .bind(trimmed, otp, expiry, new Date().toISOString()).run();
            await sendEmail(c.env, trimmed, 'Boxbi - Password Reset', otpEmailHtml(otp, 'Your password reset code:'));
        }
        return c.json({ message: 'If an account with that email exists, a reset code has been sent.' }, 200);
    } catch { return c.json({ error: 'Internal server error' }, 500); }
});

auth.post('/password-reset/confirm', async (c) => {
    try {
        const { email, otp, secret } = await c.req.json();
        if (!email?.trim() || !otp?.trim() || !secret?.trim()) return c.json({ error: 'Email, OTP and new password are required' }, 400);
        if (secret.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

        const trimmed = email.trim().toLowerCase();
        const pending = await c.env.DB.prepare('SELECT * FROM password_reset_otps WHERE email=?').bind(trimmed).first() as any;

        if (!pending) return c.json({ error: 'Invalid or expired reset code' }, 400);
        if (new Date() > new Date(pending.expiry_time)) {
            await c.env.DB.prepare('DELETE FROM password_reset_otps WHERE id=?').bind(pending.id).run();
            return c.json({ error: 'OTP expired. Please request a new one.' }, 400);
        }
        if (!timingSafeEqual(String(pending.otp), otp.trim())) {
            // Brute-force protection — invalidate the code after too many wrong tries
            const attempts = (pending.attempts ?? 0) + 1;
            if (attempts >= MAX_OTP_ATTEMPTS) {
                await c.env.DB.prepare('DELETE FROM password_reset_otps WHERE id=?').bind(pending.id).run();
                return c.json({ error: 'Too many wrong attempts. Please request a new code.' }, 429);
            }
            await c.env.DB.prepare('UPDATE password_reset_otps SET attempts=? WHERE id=?').bind(attempts, pending.id).run();
            return c.json({ error: 'Invalid or expired reset code' }, 400);
        }

        const hashed = await hashPassword(secret);
        await c.env.DB.batch([
            c.env.DB.prepare('UPDATE users SET password_hash=? WHERE LOWER(email)=?').bind(hashed, trimmed),
            c.env.DB.prepare('DELETE FROM password_reset_otps WHERE id=?').bind(pending.id),
            c.env.DB.prepare('DELETE FROM refresh_tokens WHERE username=(SELECT username FROM users WHERE LOWER(email)=?)').bind(trimmed),
        ]);
        return c.json({ message: 'Password reset successful. Please log in again.' }, 200);
    } catch { return c.json({ error: 'Internal server error' }, 500); }
});

// ─── Login (with account lockout + refresh tokens) ───────────────────────────

auth.post('/login', async (c) => {
    const { username, secret } = await c.req.json();
    if (!username || !secret) return c.json({ error: 'Username and password are required' }, 400);

    const trimmed = username.trim();

    // Lockout is keyed by username+IP so a remote attacker can't lock the real user out
    const ip      = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const lockKey = `${trimmed}|${ip}`;
    const lockRecord = await c.env.DB.prepare(
        'SELECT attempts, locked_until FROM login_attempts WHERE username=?'
    ).bind(lockKey).first() as any;

    if (lockRecord?.locked_until && new Date() < new Date(lockRecord.locked_until)) {
        const mins = Math.ceil((new Date(lockRecord.locked_until).getTime() - Date.now()) / 60000);
        return c.json({ error: `Account locked. Try again in ${mins} minute(s).` }, 429);
    }

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username=?').bind(trimmed).first() as any;
    const valid = user && await verifyPassword(secret, user.password_hash);

    if (!valid) {
        const attempts = (lockRecord?.attempts ?? 0) + 1;
        const lockedUntil = attempts >= MAX_LOGIN_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : null;
        await c.env.DB.prepare(`
            INSERT INTO login_attempts (username, attempts, locked_until, last_attempt)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(username) DO UPDATE SET
                attempts = excluded.attempts,
                locked_until = excluded.locked_until,
                last_attempt = CURRENT_TIMESTAMP
        `).bind(lockKey, attempts, lockedUntil).run();

        if (attempts >= MAX_LOGIN_ATTEMPTS)
            return c.json({ error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` }, 429);
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Clear failed attempts + update last active
    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM login_attempts WHERE username=?').bind(lockKey),
        c.env.DB.prepare('UPDATE users SET last_active=CURRENT_TIMESTAMP WHERE id=?').bind(user.id),
    ]);

    // Access token (24h)
    const now = Math.floor(Date.now() / 1000);
    const accessToken = await sign({ sub: user.username as string, iat: now, exp: now + ACCESS_TOKEN_TTL_SEC }, c.env.JWT_SECRET);

    // Refresh token (30 days) — rotate old ones, keep last MAX_DEVICES
    const { token: refreshToken, hash: rtHash } = await generateRefreshToken();
    const rtExpiry = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000).toISOString();
    await c.env.DB.prepare(`
        DELETE FROM refresh_tokens WHERE username=? AND id NOT IN (
            SELECT id FROM refresh_tokens WHERE username=? ORDER BY created_at DESC LIMIT ?
        )
    `).bind(trimmed, trimmed, MAX_DEVICES - 1).run();
    await c.env.DB.prepare('INSERT INTO refresh_tokens (username, token_hash, expires_at) VALUES (?,?,?)').bind(trimmed, rtHash, rtExpiry).run();

    return c.json({ token: accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SEC, user: safeUser(user) });
});

// ─── Refresh token ────────────────────────────────────────────────────────────

auth.post('/refresh-token', async (c) => {
    const { refreshToken } = await c.req.json();
    if (!refreshToken) return c.json({ error: 'Refresh token required' }, 400);

    let tokenHash: string;
    try { tokenHash = await hashRefreshToken(refreshToken); }
    catch { return c.json({ error: 'Invalid refresh token' }, 401); }

    const stored = await c.env.DB.prepare('SELECT * FROM refresh_tokens WHERE token_hash=?').bind(tokenHash).first() as any;
    if (!stored) return c.json({ error: 'Invalid or revoked refresh token' }, 401);
    if (new Date() > new Date(stored.expires_at)) {
        await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE id=?').bind(stored.id).run();
        return c.json({ error: 'Refresh token expired. Please log in again.' }, 401);
    }

    const now = Math.floor(Date.now() / 1000);
    const newToken = await sign({ sub: stored.username as string, iat: now, exp: now + ACCESS_TOKEN_TTL_SEC }, c.env.JWT_SECRET);
    return c.json({ token: newToken, expiresIn: ACCESS_TOKEN_TTL_SEC });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

auth.post('/logout', requireAuth, async (c) => {
    const authUser = getAuthUser(c);
    const { refreshToken, allDevices } = await c.req.json().catch(() => ({}));

    if (allDevices) {
        await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE username=?').bind(authUser).run();
    } else if (refreshToken) {
        try {
            const tokenHash = await hashRefreshToken(refreshToken);
            await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE token_hash=?').bind(tokenHash).run();
        } catch { /* Invalid token format — still succeed */ }
    }
    return c.json({ message: 'Logged out' });
});

export default auth;
