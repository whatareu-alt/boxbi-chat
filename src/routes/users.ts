import { Hono } from 'hono';
import type { Bindings } from '../types';
import { escapeLike } from '../lib/crypto';
import { getAuthUser } from '../lib/util';

const users = new Hono<{ Bindings: Bindings }>();

// ─── Users ────────────────────────────────────────────────────────────────────
// NOTE: specific routes (/search, /me/*, /blocked) MUST stay before /:username

// Search by username OR first/last name
users.get('/search', async (c) => {
    const q = (c.req.query('q') ?? c.req.query('username') ?? '').trim();
    if (q.length < 1) {
        // Empty query -> "Discover" list: return recent users (the client filters out self)
        const all = await c.env.DB.prepare(
            `SELECT id, username, first_name, last_name, bio, profile_picture_url, is_online
             FROM users ORDER BY last_active DESC LIMIT 50`
        ).all();
        return c.json(all.results);
    }
    const like = `%${escapeLike(q)}%`;
    const rows = await c.env.DB.prepare(
        `SELECT id, username, first_name, last_name, bio, profile_picture_url, is_online
         FROM users WHERE username LIKE ? ESCAPE '\\' OR first_name LIKE ? ESCAPE '\\' OR last_name LIKE ? ESCAPE '\\' LIMIT 20`
    ).bind(like, like, like).all();
    return c.json(rows.results);
});

// Active sessions list
users.get('/me/sessions', async (c) => {
    const authUser = getAuthUser(c);
    const rows = await c.env.DB.prepare(
        'SELECT id, created_at, expires_at FROM refresh_tokens WHERE username=? ORDER BY created_at DESC'
    ).bind(authUser).all();
    return c.json(rows.results);
});

users.delete('/me/sessions/:id', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare('DELETE FROM refresh_tokens WHERE id=? AND username=?').bind(c.req.param('id'), authUser).run();
    return c.json({ message: 'Session revoked' });
});

// Blocked users list
users.get('/blocked', async (c) => {
    const authUser = getAuthUser(c);
    const rows = await c.env.DB.prepare(
        `SELECT b.blocked as username, u.first_name, u.last_name, u.profile_picture_url
         FROM blocked_users b JOIN users u ON b.blocked=u.username WHERE b.blocker=?`
    ).bind(authUser).all();
    return c.json(rows.results);
});

users.get('/:username', async (c) => {
    const user = await c.env.DB.prepare(
        'SELECT id, username, first_name, last_name, bio, profile_picture_url, is_online, last_active, created_at FROM users WHERE username=?'
    ).bind(c.req.param('username')).first();
    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json(user);
});

users.put('/:username', async (c) => {
    const authUser = getAuthUser(c);
    const username = c.req.param('username');
    if (authUser !== username) return c.json({ error: 'Forbidden' }, 403);

    const { firstName, lastName, email, bio } = await c.req.json();
    if (!firstName || !lastName || !email) return c.json({ error: 'Missing fields' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: 'Invalid email' }, 400);

    // Email must stay unique — otherwise password reset could hit the wrong account
    const taken = await c.env.DB.prepare(
        'SELECT id FROM users WHERE LOWER(email)=? AND username!=?'
    ).bind(email.toLowerCase(), username).first();
    if (taken) return c.json({ error: 'Email is already in use by another account' }, 409);

    try {
        await c.env.DB.prepare(
            'UPDATE users SET first_name=?, last_name=?, email=?, bio=? WHERE username=?'
        ).bind(firstName.trim(), lastName.trim(), email.toLowerCase(), (bio ?? '').trim().slice(0, 200), username).run();
    } catch { return c.json({ error: 'Email is already in use by another account' }, 409); }
    return c.json({ message: 'Profile updated' });
});

// Block a user
users.post('/:username/block', async (c) => {
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
users.delete('/:username/block', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare('DELETE FROM blocked_users WHERE blocker=? AND blocked=?').bind(authUser, c.req.param('username')).run();
    return c.json({ message: 'User unblocked' });
});

users.delete('/:username', async (c) => {
    const authUser = getAuthUser(c);
    const username = c.req.param('username');
    if (authUser !== username) return c.json({ error: 'Forbidden' }, 403);

    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM message_reads WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM group_members WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE sender=? OR recipient=?)').bind(username, username),
        c.env.DB.prepare('DELETE FROM message_reactions WHERE username=? OR message_id IN (SELECT id FROM messages WHERE sender=? OR recipient=?)').bind(username, username, username),
        c.env.DB.prepare('DELETE FROM pinned_messages WHERE pinned_by=? OR message_id IN (SELECT id FROM messages WHERE sender=? OR recipient=?)').bind(username, username, username),
        c.env.DB.prepare('DELETE FROM messages WHERE sender=? OR recipient=?').bind(username, username),
        c.env.DB.prepare('DELETE FROM friend_requests WHERE sender_username=? OR receiver_username=?').bind(username, username),
        c.env.DB.prepare('DELETE FROM blocked_users WHERE blocker=? OR blocked=?').bind(username, username),
        c.env.DB.prepare('DELETE FROM refresh_tokens WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM unread_counts WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM otp_verifications WHERE username=?').bind(username),
        c.env.DB.prepare('DELETE FROM password_reset_otps WHERE email=(SELECT email FROM users WHERE username=?)').bind(username),
        c.env.DB.prepare("DELETE FROM login_attempts WHERE username=? OR username LIKE ? || '|%'").bind(username, username),
        c.env.DB.prepare('DELETE FROM users WHERE username=?').bind(username),
    ]);
    return c.json({ message: 'Account deleted' });
});

export default users;
