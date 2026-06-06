import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt, sign, verify } from 'hono/jwt';
import { ChatDO } from './ChatDO';

export { ChatDO };

// ─── Types ────────────────────────────────────────────────────────────────────

type Bindings = {
    DB: D1Database;
    JWT_SECRET: string;
    CHAT_DO: DurableObjectNamespace;
    ADMIN_RESET_SECRET: string;
    RESEND_API_KEY?: string;       // Optional: real email via Resend.com
    R2_BUCKET?: R2Bucket;          // Optional: avatar uploads via Cloudflare R2
};

type JWTPayload = { sub: string; iat: number; exp: number };

const app = new Hono<{ Bindings: Bindings }>();

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
    'https://boxbi.online',
    'https://www.boxbi.online',
    'https://boxbichat.netlify.app',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
];

const MAX_LOGIN_ATTEMPTS     = 5;
const LOCKOUT_MINUTES        = 15;
const ACCESS_TOKEN_TTL_SEC   = 86_400;       // 24 hours
const REFRESH_TOKEN_TTL_DAYS = 30;
const MAX_DEVICES            = 5;            // refresh tokens kept per user

// ─── CORS ─────────────────────────────────────────────────────────────────────

app.use('*', cors({
    origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 3600,
}));

// ─── Crypto helpers ───────────────────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
    const enc  = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const buf  = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
    return `pbkdf2:${bufToHex(salt)}:${bufToHex(new Uint8Array(buf))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
    if (!stored?.startsWith('pbkdf2:')) return false;
    const [, saltHex, hashHex] = stored.split(':');
    const salt = hexToBuf(saltHex);
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const buf  = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
    return timingSafeEqual(bufToHex(new Uint8Array(buf)), hashHex);
}

function bufToHex(buf: Uint8Array): string {
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex: string): Uint8Array {
    const pairs = hex.match(/.{2}/g);
    if (!pairs) throw new Error('Invalid hex');
    return new Uint8Array(pairs.map(b => parseInt(b, 16)));
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function generateOtp(): string {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return String(100000 + (a[0] % 900000));
}

async function generateRefreshToken(): Promise<{ token: string; hash: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = bufToHex(bytes);
    const hash  = bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    return { token, hash };
}

async function hashRefreshToken(rawToken: string): Promise<string> {
    const bytes = hexToBuf(rawToken);
    return bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function safeUser(user: any) {
    const { password_hash, secret, ...safe } = user;
    return safe;
}

function getAuthUser(c: any): string {
    return (c.get('jwtPayload') as JWTPayload).sub;
}

// ─── Email helper (Resend.com with console fallback) ─────────────────────────

async function sendEmail(env: Bindings, to: string, subject: string, html: string): Promise<void> {
    if (!env.RESEND_API_KEY) {
        console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
        return;
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Boxbi <noreply@boxbi.online>', to: [to], subject, html }),
    });
    if (!res.ok) console.error('[EMAIL] Resend error:', await res.text());
}

function otpEmailHtml(otp: string, purpose: string): string {
    return `<div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#6366f1">Boxbi Messenger</h2>
        <p>${purpose}</p>
        <div style="background:#f3f4f6;border-radius:8px;padding:24px;text-align:center;font-size:32px;letter-spacing:8px;font-weight:bold;color:#111">${otp}</div>
        <p style="color:#6b7280;font-size:13px">This code expires in 5 minutes. Do not share it with anyone.</p>
    </div>`;
}

// ─── Internal WS broadcast helper ────────────────────────────────────────────

async function wsBroadcast(env: Bindings, message: object): Promise<void> {
    const id = env.CHAT_DO.idFromName('global-chat');
    await env.CHAT_DO.get(id).fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
    }));
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

const requireAuth = (c: any, next: any) =>
    jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, next);

app.use('/users/*',    requireAuth);
app.use('/friends/*',  requireAuth);
app.use('/groups/*',   requireAuth);
app.use('/messages/*', requireAuth);

// ─── Signup ───────────────────────────────────────────────────────────────────

app.post('/signup', async (c) => {
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

        const otp = generateOtp();
        const hashed = await hashPassword(secret);
        const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await c.env.DB.prepare('DELETE FROM otp_verifications WHERE LOWER(username)=? OR LOWER(email)=?')
            .bind(username.toLowerCase(), email.toLowerCase()).run();
        await c.env.DB.prepare(
            'INSERT INTO otp_verifications (username, email, secret, first_name, last_name, otp, expiry_time) VALUES (?,?,?,?,?,?,?)'
        ).bind(username, email.toLowerCase(), hashed, firstName || '', lastName || '', otp, expiry).run();

        await sendEmail(c.env, email, 'Boxbi - Verify your account', otpEmailHtml(otp, 'Your signup verification code:'));
        return c.json({ otpRequired: true, email: email.toLowerCase(), username }, 200);
    } catch { return c.json({ error: 'Internal server error' }, 500); }
});

app.post('/signup/verify', async (c) => {
    try {
        const { username, email, otp } = await c.req.json();
        if (!username || !email || !otp) return c.json({ error: 'Username, email, and OTP are required' }, 400);

        const pending = await c.env.DB.prepare('SELECT * FROM otp_verifications WHERE username=?').bind(username.trim()).first() as any;
        if (!pending) return c.json({ error: 'No pending registration found' }, 400);
        if (pending.email.toLowerCase() !== email.trim().toLowerCase()) return c.json({ error: 'Email does not match' }, 400);
        if (!timingSafeEqual(String(pending.otp), otp.trim())) return c.json({ error: 'Invalid OTP code' }, 400);
        if (new Date() > new Date(pending.expiry_time)) {
            await c.env.DB.prepare('DELETE FROM otp_verifications WHERE id=?').bind(pending.id).run();
            return c.json({ error: 'OTP expired. Please sign up again.' }, 400);
        }

        await c.env.DB.prepare(
            'INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES (?,?,?,?,?)'
        ).bind(pending.username, pending.email, pending.secret, pending.first_name, pending.last_name).run();
        await c.env.DB.prepare('DELETE FROM otp_verifications WHERE id=?').bind(pending.id).run();

        const newUser = await c.env.DB.prepare(
            'SELECT id,username,email,first_name,last_name,created_at FROM users WHERE username=?'
        ).bind(pending.username).first();
        return c.json(newUser, 201);
    } catch { return c.json({ error: 'Internal server error' }, 500); }
});

// ─── Password reset ───────────────────────────────────────────────────────────

app.post('/password-reset/request', async (c) => {
    try {
        const { email } = await c.req.json();
        if (!email?.trim()) return c.json({ error: 'Email is required' }, 400);
        const trimmed = email.trim().toLowerCase();

        const user = await c.env.DB.prepare('SELECT id FROM users WHERE LOWER(email)=?').bind(trimmed).first();
        if (user) {
            const otp = generateOtp();
            const expiry = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            await c.env.DB.prepare('DELETE FROM password_reset_otps WHERE email=?').bind(trimmed).run();
            await c.env.DB.prepare('INSERT INTO password_reset_otps (email, otp, expiry_time) VALUES (?,?,?)').bind(trimmed, otp, expiry).run();
            await sendEmail(c.env, trimmed, 'Boxbi - Password Reset', otpEmailHtml(otp, 'Your password reset code:'));
        }
        return c.json({ message: 'If an account with that email exists, a reset code has been sent.' }, 200);
    } catch { return c.json({ error: 'Internal server error' }, 500); }
});

app.post('/password-reset/confirm', async (c) => {
    try {
        const { email, otp, secret } = await c.req.json();
        if (!email?.trim() || !otp?.trim() || !secret?.trim()) return c.json({ error: 'Email, OTP and new password are required' }, 400);
        if (secret.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);

        const trimmed = email.trim().toLowerCase();
        const pending = await c.env.DB.prepare('SELECT * FROM password_reset_otps WHERE email=?').bind(trimmed).first() as any;

        if (!pending || !timingSafeEqual(String(pending.otp), otp.trim()))
            return c.json({ error: 'Invalid or expired reset code' }, 400);
        if (new Date() > new Date(pending.expiry_time)) {
            await c.env.DB.prepare('DELETE FROM password_reset_otps WHERE id=?').bind(pending.id).run();
            return c.json({ error: 'OTP expired. Please request a new one.' }, 400);
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

app.post('/login', async (c) => {
    const { username, secret } = await c.req.json();
    if (!username || !secret) return c.json({ error: 'Username and password are required' }, 400);

    const trimmed = username.trim();

    // Check lockout
    const lockRecord = await c.env.DB.prepare(
        'SELECT attempts, locked_until FROM login_attempts WHERE username=?'
    ).bind(trimmed).first() as any;

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
        `).bind(trimmed, attempts, lockedUntil).run();

        if (attempts >= MAX_LOGIN_ATTEMPTS)
            return c.json({ error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` }, 429);
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Clear failed attempts + update last active
    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM login_attempts WHERE username=?').bind(trimmed),
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

app.post('/refresh-token', async (c) => {
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

app.post('/logout', requireAuth, async (c) => {
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

// ─── Users ────────────────────────────────────────────────────────────────────

// Search by username OR first/last name
app.get('/users/search', async (c) => {
    const q = (c.req.query('q') ?? c.req.query('username') ?? '').trim();
    if (q.length < 1) return c.json([]);
    const rows = await c.env.DB.prepare(
        `SELECT id, username, first_name, last_name, bio, profile_picture_url, is_online
         FROM users WHERE username LIKE ? OR first_name LIKE ? OR last_name LIKE ? LIMIT 20`
    ).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();
    return c.json(rows.results);
});

// Active sessions list — MUST be before /users/:username
app.get('/users/me/sessions', async (c) => {
    const authUser = getAuthUser(c);
    const rows = await c.env.DB.prepare(
        'SELECT id, created_at, expires_at FROM refresh_tokens WHERE username=? ORDER BY created_at DESC'
    ).bind(authUser).all();
    return c.json(rows.results);
});

app.delete('/users/me/sessions/:id', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE id=? AND username=?').bind(c.req.param('id'), authUser).run();
    return c.json({ message: 'Session revoked' });
});

// Blocked users list — MUST be before /users/:username
app.get('/users/blocked', async (c) => {
    const authUser = getAuthUser(c);
    const rows = await c.env.DB.prepare(
        `SELECT b.blocked as username, u.first_name, u.last_name, u.profile_picture_url
         FROM blocked_users b JOIN users u ON b.blocked=u.username WHERE b.blocker=?`
    ).bind(authUser).all();
    return c.json(rows.results);
});

app.get('/users/:username', async (c) => {
    const user = await c.env.DB.prepare(
        'SELECT id, username, first_name, last_name, bio, profile_picture_url, is_online, last_active, created_at FROM users WHERE username=?'
    ).bind(c.req.param('username')).first();
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json(user);
});

app.put('/users/:username', async (c) => {
    const authUser = getAuthUser(c);
    const username = c.req.param('username');
    if (authUser !== username) return c.json({ error: 'Forbidden' }, 403);

    const { firstName, lastName, email, bio } = await c.req.json();
    if (!firstName || !lastName || !email) return c.json({ error: 'Missing fields' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email' }, 400);

    await c.env.DB.prepare(
        'UPDATE users SET first_name=?, last_name=?, email=?, bio=? WHERE username=?'
    ).bind(firstName.trim(), lastName.trim(), email.toLowerCase(), (bio ?? '').trim().slice(0, 200), username).run();
    return c.json({ message: 'Profile updated' });
});

// Avatar upload — requires R2_BUCKET binding
app.put('/users/:username/avatar', async (c) => {
    const authUser = getAuthUser(c);
    const username = c.req.param('username');
    if (authUser !== username) return c.json({ error: 'Forbidden' }, 403);
    if (!c.env.R2_BUCKET) return c.json({ error: 'File storage not configured' }, 503);

    const formData = await c.req.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) return c.json({ error: 'No file provided' }, 400);

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) return c.json({ error: 'Only JPEG, PNG, WebP or GIF allowed' }, 400);
    if (file.size > 2 * 1024 * 1024) return c.json({ error: 'File must be under 2 MB' }, 400);

    const ext = file.type.split('/')[1];
    const key = `avatars/${username}.${ext}`;
    await c.env.R2_BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });

    const url = `https://assets.boxbi.online/${key}`;
    await c.env.DB.prepare('UPDATE users SET profile_picture_url=? WHERE username=?').bind(url, username).run();
    return c.json({ profilePictureUrl: url });
});

// Block a user
app.post('/users/:username/block', async (c) => {
    const authUser = getAuthUser(c);
    const target   = c.req.param('username');
    if (authUser === target) return c.json({ error: 'Cannot block yourself' }, 400);
    const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username=?').bind(target).first();
    if (!exists) return c.json({ error: 'User not found' }, 404);
    try {
        await c.env.DB.batch([
            c.env.DB.prepare('INSERT INTO blocked_users (blocker, blocked) VALUES (?,?)').bind(authUser, target),
            // Auto-unfriend on block
            c.env.DB.prepare(`DELETE FROM friend_requests WHERE status='ACCEPTED' AND
                ((sender_username=? AND receiver_username=?) OR (sender_username=? AND receiver_username=?))`
            ).bind(authUser, target, target, authUser),
        ]);
        return c.json({ message: 'User blocked' });
    } catch { return c.json({ error: 'Already blocked' }, 409); }
});

// Unblock a user
app.delete('/users/:username/block', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare('DELETE FROM blocked_users WHERE blocker=? AND blocked=?').bind(authUser, c.req.param('username')).run();
    return c.json({ message: 'User unblocked' });
});

app.delete('/users/:username', async (c) => {
    const authUser = getAuthUser(c);
    const username = c.req.param('username');
    if (authUser !== username) return c.json({ error: 'Forbidden' }, 403);

    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM message_reads WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM group_members WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE sender=? OR recipient=?)').bind(username, username),
        c.env.DB.prepare('DELETE FROM messages WHERE sender=? OR recipient=?').bind(username, username),
        c.env.DB.prepare('DELETE FROM friend_requests WHERE sender_username=? OR receiver_username=?').bind(username, username),
        c.env.DB.prepare('DELETE FROM refresh_tokens WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM unread_counts WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM otp_verifications WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM users WHERE username=?').bind(username),
    ]);
    return c.json({ message: 'Account deleted' });
});

// ─── Friends ──────────────────────────────────────────────────────────────────

app.post('/friends/request', async (c) => {
    const authUser = getAuthUser(c);
    const { receiver } = await c.req.json();
    // Use verified JWT identity — never trust sender from request body
    const sender = authUser;
    if (!receiver) return c.json({ error: 'Receiver is required' }, 400);
    if (sender === receiver) return c.json({ error: 'Cannot send a friend request to yourself' }, 400);

    const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username=?').bind(receiver).first();
    if (!exists) return c.json({ error: 'User not found' }, 404);

    try {
        await c.env.DB.prepare('INSERT INTO friend_requests (sender_username, receiver_username) VALUES (?,?)').bind(sender, receiver).run();
        return c.json({ message: 'Friend request sent' });
    } catch { return c.json({ error: 'Friend request already exists' }, 409); }
});

app.delete('/friends/:friend', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare(`
        DELETE FROM friend_requests WHERE status='ACCEPTED' AND
        ((sender_username=? AND receiver_username=?) OR (sender_username=? AND receiver_username=?))
    `).bind(authUser, c.req.param('friend'), c.req.param('friend'), authUser).run();
    return c.json({ message: 'Unfriended' });
});

app.get('/friends/requests/pending', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT * FROM friend_requests WHERE receiver_username=? AND status="PENDING"'
    ).bind(getAuthUser(c)).all();
    return c.json(rows.results);
});

app.post('/friends/accept/:id', async (c) => {
    const authUser = getAuthUser(c);
    const req = await c.env.DB.prepare(
        'SELECT id FROM friend_requests WHERE id=? AND receiver_username=? AND status="PENDING"'
    ).bind(c.req.param('id'), authUser).first();
    if (!req) return c.json({ error: 'Request not found' }, 404);
    await c.env.DB.prepare('UPDATE friend_requests SET status="ACCEPTED" WHERE id=?').bind(c.req.param('id')).run();
    return c.json({ message: 'Accepted' });
});

app.post('/friends/reject/:id', async (c) => {
    const authUser = getAuthUser(c);
    const req = await c.env.DB.prepare(
        'SELECT id FROM friend_requests WHERE id=? AND receiver_username=? AND status="PENDING"'
    ).bind(c.req.param('id'), authUser).first();
    if (!req) return c.json({ error: 'Request not found' }, 404);
    await c.env.DB.prepare('UPDATE friend_requests SET status="REJECTED" WHERE id=?').bind(c.req.param('id')).run();
    return c.json({ message: 'Rejected' });
});

app.get('/friends/list', async (c) => {
    const authUser = getAuthUser(c);
    const rows = await c.env.DB.prepare(`
        SELECT CASE WHEN sender_username=? THEN receiver_username ELSE sender_username END as friend
        FROM friend_requests WHERE (sender_username=? OR receiver_username=?) AND status="ACCEPTED"
    `).bind(authUser, authUser, authUser).all();
    return c.json(rows.results.map((r: any) => r.friend));
});

// ─── Groups ───────────────────────────────────────────────────────────────────

app.post('/groups/create', async (c) => {
    const authUser = getAuthUser(c);
    const { name, members, description } = await c.req.json();
    // Use verified JWT identity — never trust createdBy from request body
    const createdBy = authUser;
    if (!name?.trim()) return c.json({ error: 'Group name is required' }, 400);

    const result = await c.env.DB.prepare(
        'INSERT INTO chat_groups (name, description, created_by) VALUES (?,?,?)'
    ).bind(name.trim(), (description ?? '').trim(), createdBy).run();
    const groupId = result.meta.last_row_id;

    const inserts: D1PreparedStatement[] = [
        c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, username, role) VALUES (?,?,?)').bind(groupId, createdBy, 'ADMIN'),
    ];
    if (Array.isArray(members)) {
        for (const m of members) {
            if (typeof m === 'string' && m !== createdBy) {
                inserts.push(c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, username) VALUES (?,?)').bind(groupId, m));
            }
        }
    }
    await c.env.DB.batch(inserts);
    return c.json({ id: groupId, name: name.trim(), createdBy }, 201);
});

app.get('/groups/user/:username', async (c) => {
    const authUser = getAuthUser(c);
    if (authUser !== c.req.param('username')) return c.json({ error: 'Forbidden' }, 403);
    const rows = await c.env.DB.prepare(
        'SELECT g.id, g.name, g.description, g.created_by, g.created_at FROM chat_groups g JOIN group_members m ON g.id=m.group_id WHERE m.username=?'
    ).bind(c.req.param('username')).all();
    return c.json(rows.results);
});

app.get('/groups/:groupId', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const member   = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first();
    if (!member) return c.json({ error: 'Forbidden' }, 403);
    const group = await c.env.DB.prepare('SELECT * FROM chat_groups WHERE id=?').bind(groupId).first();
    if (!group) return c.json({ error: 'Group not found' }, 404);
    return c.json(group);
});

app.put('/groups/:groupId', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const { name, description } = await c.req.json();
    if (!name?.trim()) return c.json({ error: 'Group name is required' }, 400);
    await c.env.DB.prepare('UPDATE chat_groups SET name=?, description=? WHERE id=?').bind(name.trim(), (description ?? '').trim(), groupId).run();
    return c.json({ message: 'Group updated' });
});

app.delete('/groups/:groupId', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM unread_counts WHERE chat_id=?').bind(`group:${groupId}`),
        c.env.DB.prepare('DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE group_id=?)').bind(groupId),
        c.env.DB.prepare('DELETE FROM group_members WHERE group_id=?').bind(groupId),
        c.env.DB.prepare('DELETE FROM messages WHERE group_id=?').bind(groupId),
        c.env.DB.prepare('DELETE FROM chat_groups WHERE id=?').bind(groupId),
    ]);
    return c.json({ message: 'Group deleted' });
});

app.get('/groups/:groupId/members', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const member   = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first();
    if (!member) return c.json({ error: 'Forbidden' }, 403);
    const rows = await c.env.DB.prepare(
        'SELECT m.username, m.role, m.joined_at, u.first_name, u.last_name, u.profile_picture_url, u.is_online FROM group_members m JOIN users u ON m.username=u.username WHERE m.group_id=?'
    ).bind(groupId).all();
    return c.json(rows.results);
});

app.post('/groups/:groupId/members', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const { members } = await c.req.json();
    if (!Array.isArray(members) || members.length === 0) return c.json({ error: 'Members array required' }, 400);

    await c.env.DB.batch(
        members.filter((m): m is string => typeof m === 'string')
            .map(m => c.env.DB.prepare('INSERT OR IGNORE INTO group_members (group_id, username) VALUES (?,?)').bind(groupId, m))
    );
    return c.json({ message: 'Members added' });
});

app.delete('/groups/:groupId/members/:username', async (c) => {
    const authUser    = getAuthUser(c);
    const groupId     = c.req.param('groupId');
    const targetUser  = c.req.param('username');
    const admin       = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const target = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, targetUser).first() as any;
    if (!target) return c.json({ error: 'Member not found' }, 404);

    if (target.role === 'ADMIN') {
        const adminCount = await c.env.DB.prepare('SELECT COUNT(*) as n FROM group_members WHERE group_id=? AND role="ADMIN"').bind(groupId).first() as any;
        if (adminCount.n <= 1) return c.json({ error: 'Cannot remove the last admin. Promote another member first.' }, 400);
    }
    await c.env.DB.prepare('DELETE FROM group_members WHERE group_id=? AND username=?').bind(groupId, targetUser).run();
    return c.json({ message: 'Member removed' });
});

app.put('/groups/:groupId/members/:username/role', async (c) => {
    const authUser   = getAuthUser(c);
    const groupId    = c.req.param('groupId');
    const targetUser = c.req.param('username');
    const { role }   = await c.req.json();
    if (!['ADMIN', 'MEMBER'].includes(role)) return c.json({ error: 'Role must be ADMIN or MEMBER' }, 400);

    const admin = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    await c.env.DB.prepare('UPDATE group_members SET role=? WHERE group_id=? AND username=?').bind(role, groupId, targetUser).run();
    return c.json({ message: `Role updated to ${role}` });
});

app.post('/groups/:groupId/leave', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const membership = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (!membership) return c.json({ error: 'You are not in this group' }, 400);

    if (membership.role === 'ADMIN') {
        const adminCount = await c.env.DB.prepare('SELECT COUNT(*) as n FROM group_members WHERE group_id=? AND role="ADMIN"').bind(groupId).first() as any;
        if (adminCount.n <= 1) {
            // Auto-promote next joined member
            const next = await c.env.DB.prepare('SELECT username FROM group_members WHERE group_id=? AND username!=? ORDER BY joined_at ASC LIMIT 1').bind(groupId, authUser).first() as any;
            if (next) await c.env.DB.prepare('UPDATE group_members SET role="ADMIN" WHERE group_id=? AND username=?').bind(groupId, next.username).run();
        }
    }

    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser),
        c.env.DB.prepare('DELETE FROM unread_counts WHERE username=? AND chat_id=?').bind(authUser, `group:${groupId}`),
    ]);

    // Clean up group if now empty
    const count = await c.env.DB.prepare('SELECT COUNT(*) as n FROM group_members WHERE group_id=?').bind(groupId).first() as any;
    if (count.n === 0) {
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE group_id=?)').bind(groupId),
            c.env.DB.prepare('DELETE FROM messages WHERE group_id=?').bind(groupId),
            c.env.DB.prepare('DELETE FROM chat_groups WHERE id=?').bind(groupId),
        ]);
    }
    return c.json({ message: 'Left group' });
});

// ─── Group invite links ───────────────────────────────────────────────────────

// Join via invite link (public — only needs JWT, no group membership)
app.post('/groups/join/:token', async (c) => {
    const authUser = getAuthUser(c);
    const token    = c.req.param('token');

    const group = await c.env.DB.prepare(
        'SELECT id, name, invite_enabled, max_members FROM chat_groups WHERE invite_token=?'
    ).bind(token).first() as any;
    if (!group) return c.json({ error: 'Invalid or expired invite link' }, 404);
    if (!group.invite_enabled) return c.json({ error: 'This invite link has been disabled' }, 403);

    const memberCount = await c.env.DB.prepare('SELECT COUNT(*) as n FROM group_members WHERE group_id=?').bind(group.id).first() as any;
    if (memberCount.n >= group.max_members) return c.json({ error: 'Group is full' }, 400);

    const existing = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(group.id, authUser).first();
    if (existing) return c.json({ message: 'Already a member', groupId: group.id, groupName: group.name });

    await c.env.DB.prepare('INSERT INTO group_members (group_id, username) VALUES (?,?)').bind(group.id, authUser).run();
    return c.json({ message: 'Joined successfully', groupId: group.id, groupName: group.name }, 201);
});

// Get invite link (admin only)
app.get('/groups/:groupId/invite', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const group = await c.env.DB.prepare('SELECT invite_token, invite_enabled FROM chat_groups WHERE id=?').bind(groupId).first() as any;
    let token = group?.invite_token;
    if (!token) {
        token = bufToHex(crypto.getRandomValues(new Uint8Array(16)));
        await c.env.DB.prepare('UPDATE chat_groups SET invite_token=? WHERE id=?').bind(token, groupId).run();
    }
    return c.json({ inviteLink: `https://boxbi.online/join/${token}`, token, enabled: group.invite_enabled === 1 });
});

// Reset invite link (generates new token, old one stops working)
app.post('/groups/:groupId/invite/reset', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const token = bufToHex(crypto.getRandomValues(new Uint8Array(16)));
    await c.env.DB.prepare('UPDATE chat_groups SET invite_token=? WHERE id=?').bind(token, groupId).run();
    return c.json({ inviteLink: `https://boxbi.online/join/${token}`, token });
});

// Toggle invite link enabled/disabled
app.put('/groups/:groupId/invite/toggle', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const group = await c.env.DB.prepare('SELECT invite_enabled FROM chat_groups WHERE id=?').bind(groupId).first() as any;
    const newVal = group?.invite_enabled ? 0 : 1;
    await c.env.DB.prepare('UPDATE chat_groups SET invite_enabled=? WHERE id=?').bind(newVal, groupId).run();
    return c.json({ inviteEnabled: newVal === 1 });
});

// ─── Pinned messages ──────────────────────────────────────────────────────────

app.get('/groups/:groupId/pins', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const member   = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first();
    if (!member) return c.json({ error: 'Forbidden' }, 403);

    const rows = await c.env.DB.prepare(`
        SELECT p.message_id, p.pinned_by, p.pinned_at, m.content, m.sender, m.timestamp
        FROM pinned_messages p JOIN messages m ON p.message_id=m.id
        WHERE p.group_id=? AND m.is_deleted=0 ORDER BY p.pinned_at DESC
    `).bind(groupId).all();
    return c.json(rows.results);
});

app.post('/groups/:groupId/pin/:messageId', async (c) => {
    const authUser   = getAuthUser(c);
    const groupId    = c.req.param('groupId');
    const messageId  = c.req.param('messageId');
    const admin      = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const msg = await c.env.DB.prepare('SELECT id FROM messages WHERE id=? AND group_id=? AND is_deleted=0').bind(messageId, groupId).first();
    if (!msg) return c.json({ error: 'Message not found in this group' }, 404);

    try {
        await c.env.DB.prepare('INSERT INTO pinned_messages (group_id, message_id, pinned_by) VALUES (?,?,?)').bind(groupId, messageId, authUser).run();
        try { await wsBroadcast(c.env, { type: 'MESSAGE_PINNED', messageId: Number(messageId), groupId: Number(groupId), pinnedBy: authUser, timestamp: Date.now() }); } catch {}
        return c.json({ message: 'Message pinned' });
    } catch { return c.json({ error: 'Already pinned' }, 409); }
});

app.delete('/groups/:groupId/pin/:messageId', async (c) => {
    const authUser  = getAuthUser(c);
    const groupId   = c.req.param('groupId');
    const messageId = c.req.param('messageId');
    const admin     = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    await c.env.DB.prepare('DELETE FROM pinned_messages WHERE group_id=? AND message_id=?').bind(groupId, messageId).run();
    try { await wsBroadcast(c.env, { type: 'MESSAGE_UNPINNED', messageId: Number(messageId), groupId: Number(groupId), timestamp: Date.now() }); } catch {}
    return c.json({ message: 'Message unpinned' });
});

// ─── Messages — specific routes BEFORE parameterised /:contact ───────────────

// Full-text message search
app.get('/messages/search', async (c) => {
    const authUser = getAuthUser(c);
    const q = (c.req.query('q') ?? '').trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
    if (q.length < 2) return c.json([]);

    const rows = await c.env.DB.prepare(`
        SELECT id, sender, recipient, group_id, content, type, timestamp
        FROM messages
        WHERE is_deleted=0 AND content LIKE ?
        AND (
            sender=? OR recipient=? OR
            group_id IN (SELECT group_id FROM group_members WHERE username=?)
        )
        ORDER BY timestamp DESC LIMIT ?
    `).bind(`%${q}%`, authUser, authUser, authUser, limit).all();
    return c.json(rows.results);
});

// Unread counts per chat
app.get('/messages/unread', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT chat_id, count FROM unread_counts WHERE username=? AND count>0'
    ).bind(getAuthUser(c)).all();
    return c.json(rows.results);
});

// Delete a single message (soft-delete)
app.delete('/messages/msg/:id', async (c) => {
    const authUser = getAuthUser(c);
    const id = c.req.param('id');
    const msg = await c.env.DB.prepare('SELECT sender, recipient, group_id FROM messages WHERE id=?').bind(id).first() as any;
    if (!msg) return c.json({ error: 'Message not found' }, 404);
    if (msg.sender !== authUser) return c.json({ error: 'Forbidden' }, 403);

    await c.env.DB.prepare('UPDATE messages SET is_deleted=1, content="This message was deleted" WHERE id=?').bind(id).run();

    // Broadcast deletion via WebSocket (non-critical — don't fail if no one connected)
    try { await wsBroadcast(c.env, { type: 'MESSAGE_DELETED', id: Number(id), sender: authUser, recipient: msg.recipient, groupId: msg.group_id, timestamp: Date.now() }); } catch { /* ignore */ }
    return c.json({ message: 'Message deleted' });
});

// Edit a message
app.put('/messages/msg/:id', async (c) => {
    const authUser = getAuthUser(c);
    const id = c.req.param('id');
    const { content } = await c.req.json();
    if (!content?.trim()) return c.json({ error: 'Content is required' }, 400);

    const msg = await c.env.DB.prepare('SELECT sender, is_deleted, recipient, group_id FROM messages WHERE id=?').bind(id).first() as any;
    if (!msg) return c.json({ error: 'Message not found' }, 404);
    if (msg.sender !== authUser) return c.json({ error: 'Forbidden' }, 403);
    if (msg.is_deleted) return c.json({ error: 'Cannot edit a deleted message' }, 400);

    await c.env.DB.prepare('UPDATE messages SET content=?, is_edited=1, edited_at=CURRENT_TIMESTAMP WHERE id=?').bind(content.trim(), id).run();

    try { await wsBroadcast(c.env, { type: 'MESSAGE_EDITED', id: Number(id), content: content.trim(), sender: authUser, recipient: msg.recipient, groupId: msg.group_id, timestamp: Date.now() }); } catch { /* ignore */ }
    return c.json({ message: 'Message edited' });
});

// Toggle emoji reaction (add if not exists, remove if exists)
app.post('/messages/msg/:id/react', async (c) => {
    const authUser = getAuthUser(c);
    const id       = c.req.param('id');
    const { emoji } = await c.req.json();
    if (!emoji || typeof emoji !== 'string' || emoji.length > 8)
        return c.json({ error: 'Valid emoji required (max 8 chars)' }, 400);

    const msg = await c.env.DB.prepare('SELECT sender, recipient, group_id, is_deleted FROM messages WHERE id=?').bind(id).first() as any;
    if (!msg) return c.json({ error: 'Message not found' }, 404);
    if (msg.is_deleted) return c.json({ error: 'Cannot react to a deleted message' }, 400);

    // Verify the user has access to this message
    let hasAccess = msg.sender === authUser || msg.recipient === authUser;
    if (!hasAccess && msg.group_id) {
        const membership = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(msg.group_id, authUser).first();
        hasAccess = !!membership;
    }
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const existing = await c.env.DB.prepare(
        'SELECT id FROM message_reactions WHERE message_id=? AND username=? AND emoji=?'
    ).bind(id, authUser, emoji).first();

    const event = existing ? 'REACTION_REMOVED' : 'REACTION_ADDED';
    if (existing) {
        await c.env.DB.prepare('DELETE FROM message_reactions WHERE message_id=? AND username=? AND emoji=?').bind(id, authUser, emoji).run();
    } else {
        await c.env.DB.prepare('INSERT INTO message_reactions (message_id, username, emoji) VALUES (?,?,?)').bind(id, authUser, emoji).run();
    }

    try { await wsBroadcast(c.env, { type: event, messageId: Number(id), username: authUser, emoji, recipient: msg.recipient, groupId: msg.group_id, timestamp: Date.now() }); } catch {}
    return c.json({ message: existing ? 'Reaction removed' : 'Reaction added', action: event });
});

// Get all reactions for a message
app.get('/messages/msg/:id/reactions', async (c) => {
    const authUser = getAuthUser(c);
    const id       = c.req.param('id');
    const msg = await c.env.DB.prepare('SELECT sender, recipient, group_id FROM messages WHERE id=?').bind(id).first() as any;
    if (!msg) return c.json({ error: 'Message not found' }, 404);

    const rows = await c.env.DB.prepare(
        `SELECT emoji, COUNT(*) as count, GROUP_CONCAT(username) as users
         FROM message_reactions WHERE message_id=? GROUP BY emoji ORDER BY count DESC`
    ).bind(id).all();
    return c.json(rows.results);
});

// Mark private conversation as read
app.post('/messages/:contact/read', async (c) => {
    const authUser = getAuthUser(c);
    const contact  = c.req.param('contact');

    const unread = await c.env.DB.prepare(`
        SELECT id FROM messages
        WHERE sender=? AND recipient=? AND is_deleted=0
        AND id NOT IN (SELECT message_id FROM message_reads WHERE username=?)
    `).bind(contact, authUser, authUser).all();

    if (unread.results.length > 0) {
        await c.env.DB.batch([
            ...unread.results.map((m: any) =>
                c.env.DB.prepare('INSERT OR IGNORE INTO message_reads (message_id, username) VALUES (?,?)').bind(m.id, authUser)
            ),
            c.env.DB.prepare('UPDATE unread_counts SET count=0 WHERE username=? AND chat_id=?').bind(authUser, `user:${contact}`),
        ]);

        // Notify sender that their messages were read
        await wsBroadcast(c.env, { type: 'READ_RECEIPT', reader: authUser, chatWith: contact, timestamp: Date.now() });
    }
    return c.json({ message: 'Marked as read' });
});

// Private message history (cursor-paginated)
app.get('/messages/:contact', async (c) => {
    const authUser = getAuthUser(c);
    const contact  = c.req.param('contact');
    const limit    = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const before   = c.req.query('before');

    const binds: unknown[] = [authUser, contact, contact, authUser];
    let sql = 'SELECT id, sender, recipient, content, type, reply_to_id, is_edited, edited_at, is_deleted, timestamp FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)';
    if (before) { sql += ' AND id<?'; binds.push(Number(before)); }
    sql += ' ORDER BY id DESC LIMIT ?';
    binds.push(limit);

    const rows = await c.env.DB.prepare(sql).bind(...binds).all();
    return c.json(rows.results.reverse());
});

app.delete('/messages/:contact', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare(
        'DELETE FROM messages WHERE (sender=? AND recipient=?) OR (sender=? AND recipient=?)'
    ).bind(authUser, c.req.param('contact'), c.req.param('contact'), authUser).run();
    await c.env.DB.prepare('DELETE FROM unread_counts WHERE username=? AND chat_id=?').bind(authUser, `user:${c.req.param('contact')}`).run();
    return c.json({ message: 'Chat deleted' });
});

// Group message history (cursor-paginated)
app.get('/groups/:groupId/messages', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const member   = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first();
    if (!member) return c.json({ error: 'Forbidden' }, 403);

    const limit  = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const before = c.req.query('before');

    const binds: unknown[] = [groupId];
    let sql = 'SELECT id, sender, group_id, content, type, reply_to_id, is_edited, edited_at, is_deleted, timestamp FROM messages WHERE group_id=?';
    if (before) { sql += ' AND id<?'; binds.push(Number(before)); }
    sql += ' ORDER BY id DESC LIMIT ?';
    binds.push(limit);

    const rows = await c.env.DB.prepare(sql).bind(...binds).all();
    return c.json(rows.results.reverse());
});

// ─── WebSocket (JWT-verified) ─────────────────────────────────────────────────

app.get('/ws', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected Upgrade: websocket', 426);

    const token = c.req.query('token');
    if (!token) return c.text('Authentication required', 401);

    let username: string;
    try {
        const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as JWTPayload;
        username = payload.sub;
    } catch { return c.text('Invalid or expired token', 401); }

    const newUrl = new URL(c.req.url);
    newUrl.searchParams.set('username', username);
    newUrl.searchParams.delete('token');

    const id = c.env.CHAT_DO.idFromName('global-chat');
    return c.env.CHAT_DO.get(id).fetch(new Request(newUrl.toString(), c.req.raw));
});

// ─── Admin reset ──────────────────────────────────────────────────────────────

app.post('/admin/reset', async (c) => {
    const { secret } = await c.req.json();
    const ADMIN_SECRET = c.env.ADMIN_RESET_SECRET;
    if (!ADMIN_SECRET) return c.json({ error: 'Admin operations are disabled' }, 403);
    if (!secret || !timingSafeEqual(secret, ADMIN_SECRET)) return c.json({ error: 'Invalid admin secret' }, 401);

    try {
        await c.env.DB.batch([
            c.env.DB.prepare('DELETE FROM group_members'),
            c.env.DB.prepare('DELETE FROM chat_groups'),
            c.env.DB.prepare('DELETE FROM message_reads'),
            c.env.DB.prepare('DELETE FROM messages'),
            c.env.DB.prepare('DELETE FROM friend_requests'),
            c.env.DB.prepare('DELETE FROM refresh_tokens'),
            c.env.DB.prepare('DELETE FROM login_attempts'),
            c.env.DB.prepare('DELETE FROM unread_counts'),
            c.env.DB.prepare('DELETE FROM password_reset_otps'),
            c.env.DB.prepare('DELETE FROM otp_verifications'),
            c.env.DB.prepare('DELETE FROM users'),
        ]);
        return c.json({ message: 'Database reset successful' });
    } catch { return c.json({ error: 'Reset failed' }, 500); }
});

export default app;
