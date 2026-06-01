import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt } from 'hono/jwt';
import { ChatDO } from './ChatDO';

export { ChatDO };

type Bindings = {
    DB: D1Database;
    JWT_SECRET: string;
    CHAT_DO: DurableObjectNamespace;
    ADMIN_RESET_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));

// Auth
app.post('/signup', async (c) => {
    const { username, email, firstName, lastName, secret } = await c.req.json();

    // Basic validation
    if (!username || !secret) return c.json({ error: 'Username and password required' }, 400);

    try {
        // In a real app, hash the password (e.g., with bcrypt or scrypt)
        // For D1, we'll store it directly for now or use a simple hashing if available
        await c.env.DB.prepare(
            'INSERT INTO users (username, email, password_hash, first_name, last_name) VALUES (?, ?, ?, ?, ?)'
        ).bind(username, email, secret, firstName, lastName).run();

        return c.json({ username, email, firstName, lastName }, 201);
    } catch (e: any) {
        if (e.message.includes('UNIQUE constraint failed')) {
            return c.json({ error: 'Username or email already exists' }, 409);
        }
        return c.json({ error: 'Internal server error' }, 500);
    }
});

app.post('/login', async (c) => {
    const { username, secret } = await c.req.json();

    const user = await c.env.DB.prepare(
        'SELECT * FROM users WHERE username = ? AND password_hash = ?'
    ).bind(username, secret).first();

    if (!user) {
        return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Update last active
    await c.env.DB.prepare('UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE username = ?').bind(username).run();

    return c.json(user);
});

// Users
app.get('/users/search', async (c) => {
    const query = c.req.query('username') || '';
    const users = await c.env.DB.prepare(
        'SELECT username, email, first_name, last_name FROM users WHERE username LIKE ?'
    ).bind(`%${query}%`).all();
    return c.json(users.results);
});

app.put('/users/:username', async (c) => {
    const username = c.req.param('username');
    const { firstName, lastName, email } = await c.req.json();
    if (!firstName || !lastName || !email) return c.json({ error: 'Missing fields' }, 400);
    await c.env.DB.prepare(
        'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE username = ?'
    ).bind(firstName, lastName, email, username).run();
    return c.json({ message: 'Profile updated' });
});

app.delete('/users/:username', async (c) => {
    const username = c.req.param('username');
    // Delete all messages involving this user
    await c.env.DB.prepare(
        'DELETE FROM messages WHERE sender = ? OR recipient = ?'
    ).bind(username, username).run();
    // Delete all friend requests involving this user
    await c.env.DB.prepare(
        'DELETE FROM friend_requests WHERE sender_username = ? OR receiver_username = ?'
    ).bind(username, username).run();
    // Delete the user
    await c.env.DB.prepare('DELETE FROM users WHERE username = ?').bind(username).run();
    return c.json({ message: 'Account deleted' });
});

// Friends
app.post('/friends/request', async (c) => {
    const { sender, receiver } = await c.req.json();
    try {
        await c.env.DB.prepare(
            'INSERT INTO friend_requests (sender_username, receiver_username) VALUES (?, ?)'
        ).bind(sender, receiver).run();
        return c.json({ message: 'Friend request sent' });
    } catch (e) {
        return c.json({ error: 'Request already exists or user not found' }, 400);
    }
});

app.delete('/friends/:friend', async (c) => {
    const friend = c.req.param('friend');
    const currentUser = c.req.query('currentUser');
    if (!currentUser) return c.json({ error: 'Missing currentUser' }, 400);
    await c.env.DB.prepare(
        `DELETE FROM friend_requests WHERE status = 'ACCEPTED' AND
        ((sender_username = ? AND receiver_username = ?) OR (sender_username = ? AND receiver_username = ?))`
    ).bind(currentUser, friend, friend, currentUser).run();
    return c.json({ message: 'Unfriended' });
});

app.get('/friends/requests/pending', async (c) => {
    const username = c.req.query('username');
    const requests = await c.env.DB.prepare(
        'SELECT * FROM friend_requests WHERE receiver_username = ? AND status = "PENDING"'
    ).bind(username).all();
    return c.json(requests.results);
});

app.post('/friends/accept/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('UPDATE friend_requests SET status = "ACCEPTED" WHERE id = ?').bind(id).run();
    return c.json({ message: 'Accepted' });
});

app.post('/friends/reject/:id', async (c) => {
    const id = c.req.param('id');
    await c.env.DB.prepare('UPDATE friend_requests SET status = "REJECTED" WHERE id = ?').bind(id).run();
    return c.json({ message: 'Rejected' });
});

app.get('/friends/list', async (c) => {
    const username = c.req.query('username');
    const friends = await c.env.DB.prepare(
        `SELECT CASE WHEN sender_username = ? THEN receiver_username ELSE sender_username END as friend 
     FROM friend_requests WHERE (sender_username = ? OR receiver_username = ?) AND status = "ACCEPTED"`
    ).bind(username, username, username).all();
    return c.json(friends.results.map((r: any) => r.friend));
});

// Groups
app.post('/groups/create', async (c) => {
    const { name, createdBy, members } = await c.req.json();
    const result = await c.env.DB.prepare(
        'INSERT INTO chat_groups (name, created_by) VALUES (?, ?)'
    ).bind(name, createdBy).run();
    const groupId = result.meta.last_row_id;

    // Add members
    await c.env.DB.prepare('INSERT INTO group_members (group_id, username) VALUES (?, ?)').bind(groupId, createdBy).run();
    if (members) {
        for (const member of members) {
            if (member !== createdBy) {
                await c.env.DB.prepare('INSERT INTO group_members (group_id, username) VALUES (?, ?)').bind(groupId, member).run();
            }
        }
    }
    return c.json({ id: groupId, name, createdBy });
});

app.get('/groups/user/:username', async (c) => {
    const username = c.req.param('username');
    const groups = await c.env.DB.prepare(
        'SELECT g.* FROM chat_groups g JOIN group_members m ON g.id = m.group_id WHERE m.username = ?'
    ).bind(username).all();
    return c.json(groups.results);
});

// Messages History
app.get('/messages/:contact', async (c) => {
    const contact = c.req.param('contact');
    const currentUser = c.req.query('currentUser');
    const messages = await c.env.DB.prepare(
        'SELECT * FROM messages WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?) ORDER BY timestamp'
    ).bind(currentUser, contact, contact, currentUser).all();
    return c.json(messages.results);
});

app.delete('/messages/:contact', async (c) => {
    const contact = c.req.param('contact');
    const currentUser = c.req.query('currentUser');
    if (!currentUser || !contact) return c.json({ error: 'Missing params' }, 400);
    await c.env.DB.prepare(
        'DELETE FROM messages WHERE (sender = ? AND recipient = ?) OR (sender = ? AND recipient = ?)'
    ).bind(currentUser, contact, contact, currentUser).run();
    return c.json({ message: 'Chat deleted' });
});

app.get('/groups/:groupId/messages', async (c) => {
    const groupId = c.req.param('groupId');
    const messages = await c.env.DB.prepare(
        'SELECT * FROM messages WHERE group_id = ? ORDER BY timestamp'
    ).bind(groupId).all();
    return c.json(messages.results);
});

// WebSocket entry point
app.get('/ws', async (c) => {
    const upgradeHeader = c.req.header('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return c.text('Expected Upgrade: websocket', 426);
    }

    const username = c.req.query('username');
    if (!username) return c.text('Username required', 400);

    const id = c.env.CHAT_DO.idFromName('global-chat');
    const durableObject = c.env.CHAT_DO.get(id);

    return durableObject.fetch(c.req.raw);
});

// Admin Database Reset
app.post('/admin/reset', async (c) => {
    const { secret } = await c.req.json();
    const ADMIN_SECRET = c.env.ADMIN_RESET_SECRET || "boxbi_secure_reset_key_7e57c6df4a51e892c90c73295e840e69123b5fde81c4e97a3da124806a9db3f1";

    if (!secret || secret !== ADMIN_SECRET) {
        return c.json({ error: 'Invalid admin secret code' }, 401);
    }

    try {
        // Delete all group members
        await c.env.DB.prepare('DELETE FROM group_members').run();
        // Delete all chat groups
        await c.env.DB.prepare('DELETE FROM chat_groups').run();
        // Delete all messages
        await c.env.DB.prepare('DELETE FROM messages').run();
        // Delete all friend requests
        await c.env.DB.prepare('DELETE FROM friend_requests').run();
        // Delete all users
        await c.env.DB.prepare('DELETE FROM users').run();

        return c.json({ message: 'Database reset successful' });
    } catch (e: any) {
        return c.json({ error: 'Reset failed: ' + e.message }, 500);
    }
});

export default app;

// Durable Object class definition would go in a separate file or here.
// For simplicity in this plan, I'll put it here or create a separate file next.
