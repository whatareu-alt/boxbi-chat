import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import { ChatDO } from './ChatDO';
import { ALLOWED_ORIGINS, type Bindings, type JWTPayload } from './types';
import { timingSafeEqual } from './lib/crypto';
import { requireAuth } from './lib/util';
import auth from './routes/auth';
import users from './routes/users';
import friends from './routes/friends';
import groups from './routes/groups';
import messages from './routes/messages';

export { ChatDO };

const app = new Hono<{ Bindings: Bindings }>();

// ─── CORS ─────────────────────────────────────────────────────────────────────

app.use('*', cors({
    origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 3600,
}));

// ─── Auth middleware ──────────────────────────────────────────────────────────

app.use('/users/*',    requireAuth);
app.use('/friends/*',  requireAuth);
app.use('/groups/*',   requireAuth);
app.use('/messages/*', requireAuth);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route('/',         auth);      // /signup, /login, /password-reset, /refresh-token, /logout
app.route('/users',    users);
app.route('/friends',  friends);
app.route('/groups',   groups);
app.route('/messages', messages);

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
            c.env.DB.prepare('DELETE FROM pinned_messages'),
            c.env.DB.prepare('DELETE FROM chat_groups'),
            c.env.DB.prepare('DELETE FROM message_reads'),
            c.env.DB.prepare('DELETE FROM message_reactions'),
            c.env.DB.prepare('DELETE FROM messages'),
            c.env.DB.prepare('DELETE FROM friend_requests'),
            c.env.DB.prepare('DELETE FROM blocked_users'),
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

// ─── Scheduled cleanup (cron) ─────────────────────────────────────────────────
// 1. Disappearing messages: anything older than MESSAGE_RETENTION is wiped,
//    along with its reads/reactions/pins.
// 2. Rolling account expiry: accounts older than USER_RETENTION are fully
//    deleted with all their data. Groups left with zero members are removed.
// 3. Housekeeping: expired tokens, OTPs, and stale lockouts.

const MESSAGE_RETENTION = '-1 day';  // messages live 24 hours
const USER_RETENTION    = '-7 days'; // accounts live 7 days

async function cleanupOldData(env: Bindings): Promise<void> {
    const oldMsgIds = `SELECT id FROM messages WHERE timestamp < datetime('now', ?)`;
    const eu        = `SELECT username FROM users WHERE created_at < datetime('now', ?)`;
    const euMsgIds  = `SELECT id FROM messages WHERE sender IN (${eu}) OR recipient IN (${eu})`;
    const emptyGroups = `SELECT g.id FROM chat_groups g WHERE NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id)`;
    const R = MESSAGE_RETENTION, U = USER_RETENTION;

    await env.DB.batch([
        // ── 1. Messages older than 24h ──
        env.DB.prepare(`DELETE FROM message_reads WHERE message_id IN (${oldMsgIds})`).bind(R),
        env.DB.prepare(`DELETE FROM message_reactions WHERE message_id IN (${oldMsgIds})`).bind(R),
        env.DB.prepare(`DELETE FROM pinned_messages WHERE message_id IN (${oldMsgIds})`).bind(R),
        env.DB.prepare(`DELETE FROM messages WHERE timestamp < datetime('now', ?)`).bind(R),

        // ── 2. Accounts older than 7 days (full cascade) ──
        env.DB.prepare(`DELETE FROM message_reads WHERE username IN (${eu}) OR message_id IN (${euMsgIds})`).bind(U, U, U),
        env.DB.prepare(`DELETE FROM message_reactions WHERE username IN (${eu}) OR message_id IN (${euMsgIds})`).bind(U, U, U),
        env.DB.prepare(`DELETE FROM pinned_messages WHERE pinned_by IN (${eu}) OR message_id IN (${euMsgIds})`).bind(U, U, U),
        env.DB.prepare(`DELETE FROM messages WHERE sender IN (${eu}) OR recipient IN (${eu})`).bind(U, U),
        env.DB.prepare(`DELETE FROM friend_requests WHERE sender_username IN (${eu}) OR receiver_username IN (${eu})`).bind(U, U),
        env.DB.prepare(`DELETE FROM blocked_users WHERE blocker IN (${eu}) OR blocked IN (${eu})`).bind(U, U),
        env.DB.prepare(`DELETE FROM group_members WHERE username IN (${eu})`).bind(U),
        env.DB.prepare(`DELETE FROM refresh_tokens WHERE username IN (${eu})`).bind(U),
        env.DB.prepare(`DELETE FROM unread_counts WHERE username IN (${eu})`).bind(U),
        env.DB.prepare(`DELETE FROM otp_verifications WHERE username IN (${eu})`).bind(U),
        env.DB.prepare(`DELETE FROM password_reset_otps WHERE email IN (SELECT email FROM users WHERE created_at < datetime('now', ?))`).bind(U),
        env.DB.prepare(`DELETE FROM login_attempts WHERE EXISTS (SELECT 1 FROM users u WHERE u.created_at < datetime('now', ?) AND (login_attempts.username = u.username OR login_attempts.username LIKE u.username || '|%'))`).bind(U),
        env.DB.prepare(`DELETE FROM users WHERE created_at < datetime('now', ?)`).bind(U),

        // ── Groups left with no members ──
        env.DB.prepare(`DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE group_id IN (${emptyGroups}))`),
        env.DB.prepare(`DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE group_id IN (${emptyGroups}))`),
        env.DB.prepare(`DELETE FROM pinned_messages WHERE group_id IN (${emptyGroups})`),
        env.DB.prepare(`DELETE FROM unread_counts WHERE chat_id IN (SELECT 'group:' || g.id FROM chat_groups g WHERE NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id))`),
        env.DB.prepare(`DELETE FROM messages WHERE group_id IN (${emptyGroups})`),
        env.DB.prepare(`DELETE FROM chat_groups WHERE NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = chat_groups.id)`),

        // ── 3. Housekeeping ──
        env.DB.prepare(`DELETE FROM refresh_tokens WHERE expires_at < datetime('now')`),
        env.DB.prepare(`DELETE FROM password_reset_otps WHERE expiry_time < datetime('now')`),
        env.DB.prepare(`DELETE FROM otp_verifications WHERE expiry_time < datetime('now')`),
        env.DB.prepare(`DELETE FROM login_attempts WHERE locked_until IS NOT NULL AND locked_until < datetime('now')`),
    ]);
}

export default {
    fetch: app.fetch,
    scheduled(_event: ScheduledController, env: Bindings, ctx: ExecutionContext) {
        ctx.waitUntil(cleanupOldData(env));
    },
};
