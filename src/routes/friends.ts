import { Hono } from 'hono';
import type { Bindings } from '../types';
import { getAuthUser } from '../lib/util';

const friends = new Hono<{ Bindings: Bindings }>();

// ─── Friends ──────────────────────────────────────────────────────────────────

friends.post('/request', async (c) => {
    const authUser = getAuthUser(c);
    const { receiver } = await c.req.json();
    // Use verified JWT identity — never trust sender from request body
    const sender = authUser;
    if (!receiver) return c.json({ error: 'Receiver is required' }, 400);
    if (sender === receiver) return c.json({ error: 'Cannot send a friend request to yourself' }, 400);

    const exists = await c.env.DB.prepare('SELECT id FROM users WHERE username=?').bind(receiver).first();
    if (!exists) return c.json({ error: 'User not found' }, 404);

    // A prior request between this pair may already exist (UNIQUE constraint).
    // PENDING/ACCEPTED -> reject; REJECTED -> allow re-sending by resetting to PENDING.
    const prior = await c.env.DB.prepare(
        'SELECT status FROM friend_requests WHERE sender_username=? AND receiver_username=?'
    ).bind(sender, receiver).first() as any;

    if (prior) {
        if (prior.status === 'ACCEPTED') return c.json({ error: 'You are already friends' }, 409);
        if (prior.status === 'PENDING')  return c.json({ error: 'Friend request already exists' }, 409);
        await c.env.DB.prepare(
            "UPDATE friend_requests SET status='PENDING', created_at=CURRENT_TIMESTAMP WHERE sender_username=? AND receiver_username=?"
        ).bind(sender, receiver).run();
        return c.json({ message: 'Friend request sent' });
    }

    try {
        await c.env.DB.prepare("INSERT INTO friend_requests (sender_username, receiver_username, status) VALUES (?,?,'PENDING')").bind(sender, receiver).run();
        return c.json({ message: 'Friend request sent' });
    } catch { return c.json({ error: 'Friend request already exists' }, 409); }
});

friends.get('/requests/pending', async (c) => {
    const rows = await c.env.DB.prepare(
        "SELECT * FROM friend_requests WHERE receiver_username=? AND status='PENDING'"
    ).bind(getAuthUser(c)).all();
    return c.json(rows.results);
});

friends.post('/accept/:id', async (c) => {
    const authUser = getAuthUser(c);
    const req = await c.env.DB.prepare(
        "SELECT id FROM friend_requests WHERE id=? AND receiver_username=? AND status='PENDING'"
    ).bind(c.req.param('id'), authUser).first();
    if (!req) return c.json({ error: 'Request not found' }, 404);
    await c.env.DB.prepare("UPDATE friend_requests SET status='ACCEPTED' WHERE id=?").bind(c.req.param('id')).run();
    return c.json({ message: 'Accepted' });
});

friends.post('/reject/:id', async (c) => {
    const authUser = getAuthUser(c);
    const req = await c.env.DB.prepare(
        "SELECT id FROM friend_requests WHERE id=? AND receiver_username=? AND status='PENDING'"
    ).bind(c.req.param('id'), authUser).first();
    if (!req) return c.json({ error: 'Request not found' }, 404);
    await c.env.DB.prepare("UPDATE friend_requests SET status='REJECTED' WHERE id=?").bind(c.req.param('id')).run();
    return c.json({ message: 'Rejected' });
});

friends.get('/list', async (c) => {
    const authUser = getAuthUser(c);
    const rows = await c.env.DB.prepare(`
        SELECT CASE WHEN sender_username=? THEN receiver_username ELSE sender_username END as friend
        FROM friend_requests WHERE (sender_username=? OR receiver_username=?) AND status='ACCEPTED'
    `).bind(authUser, authUser, authUser).all();
    return c.json(rows.results.map((r: any) => r.friend));
});

friends.delete('/:friend', async (c) => {
    const authUser = getAuthUser(c);
    await c.env.DB.prepare(`
        DELETE FROM friend_requests WHERE status='ACCEPTED' AND
        ((sender_username=? AND receiver_username=?) OR (sender_username=? AND receiver_username=?))
    `).bind(authUser, c.req.param('friend'), c.req.param('friend'), authUser).run();
    return c.json({ message: 'Unfriended' });
});

export default friends;
