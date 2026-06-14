import { Hono } from 'hono';
import type { Bindings } from '../types';
import { escapeLike } from '../lib/crypto';
import { getAuthUser, wsBroadcast } from '../lib/util';

const messages = new Hono<{ Bindings: Bindings }>();

// ─── Messages — specific routes BEFORE parameterised /:contact ───────────────

// Full-text message search
messages.get('/search', async (c) => {
    const authUser = getAuthUser(c);
    const q = (c.req.query('q') ?? '').trim();
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
    if (q.length < 2) return c.json([]);

    const rows = await c.env.DB.prepare(`
        SELECT id, sender, recipient, group_id, content, type, timestamp
        FROM messages
        WHERE is_deleted=0 AND content LIKE ? ESCAPE '\\'
        AND (
            sender=? OR recipient=? OR
            group_id IN (SELECT group_id FROM group_members WHERE username=?)
        )
        ORDER BY timestamp DESC LIMIT ?
    `).bind(`%${escapeLike(q)}%`, authUser, authUser, authUser, limit).all();
    return c.json(rows.results);
});

// Unread counts per chat
messages.get('/unread', async (c) => {
    const rows = await c.env.DB.prepare(
        'SELECT chat_id, count FROM unread_counts WHERE username=? AND count>0'
    ).bind(getAuthUser(c)).all();
    return c.json(rows.results);
});

// Delete a single message (soft-delete)
messages.delete('/msg/:id', async (c) => {
    const authUser = getAuthUser(c);
    const id = c.req.param('id');
    const msg = await c.env.DB.prepare('SELECT sender, recipient, group_id FROM messages WHERE id=?').bind(id).first() as any;
    if (!msg) return c.json({ error: 'Message not found' }, 404);
    if (msg.sender !== authUser) return c.json({ error: 'Forbidden' }, 403);

    await c.env.DB.prepare("UPDATE messages SET is_deleted=1, content='This message was deleted' WHERE id=?").bind(id).run();

    // Broadcast deletion via WebSocket (non-critical — don't fail if no one connected)
    try { await wsBroadcast(c.env, { type: 'MESSAGE_DELETED', id: Number(id), sender: authUser, recipient: msg.recipient, groupId: msg.group_id, timestamp: Date.now() }); } catch { /* ignore */ }
    return c.json({ message: 'Message deleted' });
});

// Edit a message
messages.put('/msg/:id', async (c) => {
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
messages.post('/msg/:id/react', async (c) => {
    const authUser = getAuthUser(c);
    const id       = c.req.param('id');
    const { emoji } = await c.req.json();
    if (!emoji || typeof emoji !== 'string' || emoji.length > 8 || /[<>&"'`=\\/]/.test(emoji))
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
messages.get('/msg/:id/reactions', async (c) => {
    const authUser = getAuthUser(c);
    const id       = c.req.param('id');
    const msg = await c.env.DB.prepare('SELECT sender, recipient, group_id FROM messages WHERE id=?').bind(id).first() as any;
    if (!msg) return c.json({ error: 'Message not found' }, 404);

    // Verify the user has access to this message
    let hasAccess = msg.sender === authUser || msg.recipient === authUser;
    if (!hasAccess && msg.group_id) {
        const membership = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(msg.group_id, authUser).first();
        hasAccess = !!membership;
    }
    if (!hasAccess) return c.json({ error: 'Forbidden' }, 403);

    const rows = await c.env.DB.prepare(
        `SELECT emoji, COUNT(*) as count, GROUP_CONCAT(username) as users
         FROM message_reactions WHERE message_id=? GROUP BY emoji ORDER BY count DESC`
    ).bind(id).all();
    return c.json(rows.results);
});

// Mark private conversation as read
messages.post('/:contact/read', async (c) => {
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
messages.get('/:contact', async (c) => {
    const authUser = getAuthUser(c);
    const contact  = c.req.param('contact');
    const limit    = Math.min(Number(c.req.query('limit') ?? 50), 100);
    const before   = c.req.query('before');

    const binds: unknown[] = [authUser, contact, contact, authUser, authUser, contact];
    // Hide anything cleared by THIS user (per-user "delete chat"); the other party still sees the history.
    let sql = `SELECT id, sender, recipient, content, type, reply_to_id, is_edited, edited_at, is_deleted, timestamp FROM messages
        WHERE ((sender=? AND recipient=?) OR (sender=? AND recipient=?))
        AND timestamp > COALESCE((SELECT cleared_at FROM chat_clears WHERE username=? AND contact=?), '')`;
    if (before) { sql += ' AND id<?'; binds.push(Number(before)); }
    sql += ' ORDER BY id DESC LIMIT ?';
    binds.push(limit);

    const rows = await c.env.DB.prepare(sql).bind(...binds).all();
    return c.json(rows.results.reverse());
});

messages.delete('/:contact', async (c) => {
    const authUser = getAuthUser(c);
    const contact  = c.req.param('contact');
    // Per-user clear: record a cutoff timestamp instead of hard-deleting shared rows,
    // so the conversation disappears for the caller but remains for the other party.
    await c.env.DB.prepare(`
        INSERT INTO chat_clears (username, contact, cleared_at) VALUES (?,?,CURRENT_TIMESTAMP)
        ON CONFLICT(username, contact) DO UPDATE SET cleared_at=CURRENT_TIMESTAMP
    `).bind(authUser, contact).run();
    await c.env.DB.prepare('DELETE FROM unread_counts WHERE username=? AND chat_id=?').bind(authUser, `user:${contact}`).run();
    return c.json({ message: 'Chat deleted' });
});

export default messages;
