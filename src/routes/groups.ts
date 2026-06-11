import { Hono } from 'hono';
import type { Bindings } from '../types';
import { bufToHex } from '../lib/crypto';
import { getAuthUser, wsBroadcast } from '../lib/util';

const groups = new Hono<{ Bindings: Bindings }>();

// ─── Groups ───────────────────────────────────────────────────────────────────

groups.post('/create', async (c) => {
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

groups.get('/user/:username', async (c) => {
    const authUser = getAuthUser(c);
    if (authUser !== c.req.param('username')) return c.json({ error: 'Forbidden' }, 403);
    const rows = await c.env.DB.prepare(
        'SELECT g.id, g.name, g.description, g.created_by, g.created_at FROM chat_groups g JOIN group_members m ON g.id=m.group_id WHERE m.username=?'
    ).bind(c.req.param('username')).all();
    return c.json(rows.results);
});

// ─── Group invite links ───────────────────────────────────────────────────────

// Join via invite link (public — only needs JWT, no group membership)
groups.post('/join/:token', async (c) => {
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

groups.get('/:groupId', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const member   = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first();
    if (!member) return c.json({ error: 'Forbidden' }, 403);
    const group = await c.env.DB.prepare('SELECT * FROM chat_groups WHERE id=?').bind(groupId).first();
    if (!group) return c.json({ error: 'Group not found' }, 404);
    return c.json(group);
});

groups.put('/:groupId', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const { name, description } = await c.req.json();
    if (!name?.trim()) return c.json({ error: 'Group name is required' }, 400);
    await c.env.DB.prepare('UPDATE chat_groups SET name=?, description=? WHERE id=?').bind(name.trim(), (description ?? '').trim(), groupId).run();
    return c.json({ message: 'Group updated' });
});

groups.delete('/:groupId', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM unread_counts WHERE chat_id=?').bind(`group:${groupId}`),
        c.env.DB.prepare('DELETE FROM message_reads WHERE message_id IN (SELECT id FROM messages WHERE group_id=?)').bind(groupId),
        c.env.DB.prepare('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE group_id=?)').bind(groupId),
        c.env.DB.prepare('DELETE FROM pinned_messages WHERE group_id=?').bind(groupId),
        c.env.DB.prepare('DELETE FROM group_members WHERE group_id=?').bind(groupId),
        c.env.DB.prepare('DELETE FROM messages WHERE group_id=?').bind(groupId),
        c.env.DB.prepare('DELETE FROM chat_groups WHERE id=?').bind(groupId),
    ]);
    return c.json({ message: 'Group deleted' });
});

// ─── Members ──────────────────────────────────────────────────────────────────

groups.get('/:groupId/members', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const member   = await c.env.DB.prepare('SELECT id FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first();
    if (!member) return c.json({ error: 'Forbidden' }, 403);
    const rows = await c.env.DB.prepare(
        'SELECT m.username, m.role, m.joined_at, u.first_name, u.last_name, u.profile_picture_url, u.is_online FROM group_members m JOIN users u ON m.username=u.username WHERE m.group_id=?'
    ).bind(groupId).all();
    return c.json(rows.results);
});

groups.post('/:groupId/members', async (c) => {
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

groups.delete('/:groupId/members/:username', async (c) => {
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

groups.put('/:groupId/members/:username/role', async (c) => {
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

groups.post('/:groupId/leave', async (c) => {
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
            c.env.DB.prepare('DELETE FROM message_reactions WHERE message_id IN (SELECT id FROM messages WHERE group_id=?)').bind(groupId),
            c.env.DB.prepare('DELETE FROM pinned_messages WHERE group_id=?').bind(groupId),
            c.env.DB.prepare('DELETE FROM messages WHERE group_id=?').bind(groupId),
            c.env.DB.prepare('DELETE FROM chat_groups WHERE id=?').bind(groupId),
        ]);
    }
    return c.json({ message: 'Left group' });
});

// Get invite link (admin only)
groups.get('/:groupId/invite', async (c) => {
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
groups.post('/:groupId/invite/reset', async (c) => {
    const authUser = getAuthUser(c);
    const groupId  = c.req.param('groupId');
    const admin    = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    const token = bufToHex(crypto.getRandomValues(new Uint8Array(16)));
    await c.env.DB.prepare('UPDATE chat_groups SET invite_token=? WHERE id=?').bind(token, groupId).run();
    return c.json({ inviteLink: `https://boxbi.online/join/${token}`, token });
});

// Toggle invite link enabled/disabled
groups.put('/:groupId/invite/toggle', async (c) => {
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

groups.get('/:groupId/pins', async (c) => {
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

groups.post('/:groupId/pin/:messageId', async (c) => {
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

groups.delete('/:groupId/pin/:messageId', async (c) => {
    const authUser  = getAuthUser(c);
    const groupId   = c.req.param('groupId');
    const messageId = c.req.param('messageId');
    const admin     = await c.env.DB.prepare('SELECT role FROM group_members WHERE group_id=? AND username=?').bind(groupId, authUser).first() as any;
    if (admin?.role !== 'ADMIN') return c.json({ error: 'Admins only' }, 403);

    await c.env.DB.prepare('DELETE FROM pinned_messages WHERE group_id=? AND message_id=?').bind(groupId, messageId).run();
    try { await wsBroadcast(c.env, { type: 'MESSAGE_UNPINNED', messageId: Number(messageId), groupId: Number(groupId), timestamp: Date.now() }); } catch {}
    return c.json({ message: 'Message unpinned' });
});

// ─── Group message history (cursor-paginated) ─────────────────────────────────

groups.get('/:groupId/messages', async (c) => {
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

export default groups;
