const MAX_MSG_PER_MINUTE = 30; // spam protection threshold

export class ChatDO {
    state: DurableObjectState;
    env: any;
    sessions: Map<WebSocket, { username: string; subscriptions: Map<string, string> }>;
    // In-memory rate limit tracker: username → { count, resetAt }
    private rateLimits: Map<string, { count: number; resetAt: number }> = new Map();

    constructor(state: DurableObjectState, env: any) {
        this.state    = state;
        this.env      = env;
        this.sessions = new Map();
    }

    /** Returns true if allowed, false if rate limit exceeded */
    private checkRateLimit(username: string): boolean {
        const now    = Date.now();
        const record = this.rateLimits.get(username);
        if (!record || now > record.resetAt) {
            this.rateLimits.set(username, { count: 1, resetAt: now + 60_000 });
            return true;
        }
        if (record.count >= MAX_MSG_PER_MINUTE) return false;
        record.count++;
        return true;
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // ── Internal broadcast API (called from REST handlers) ────────────────
        // REST endpoints call this to push real-time events to connected users.
        if (url.pathname === '/broadcast' && request.method === 'POST') {
            const message = await request.json() as any;
            this.dispatchEvent(message);
            return new Response('OK', { status: 200 });
        }

        // ── WebSocket upgrade ─────────────────────────────────────────────────
        const username = url.searchParams.get('username');
        if (!username) return new Response('Unauthorized', { status: 401 });

        const pair   = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];
        await this.handleSession(server, username);

        // @ts-ignore - Cloudflare-specific ResponseInit property
        return new Response(null, { status: 101, webSocket: client });
    }

    // ── WebSocket session ─────────────────────────────────────────────────────

    async handleSession(ws: WebSocket, username: string): Promise<void> {
        ws.accept();
        this.sessions.set(ws, { username, subscriptions: new Map() });

        // Announce user is online
        await this.setOnlineStatus(username, true);
        this.broadcastPresence(username, true);

        ws.addEventListener('message', async (event) => {
            try {
                const frame = event.data as string;

                if (frame.startsWith('CONNECT')) {
                    ws.send('CONNECTED\nversion:1.1\n\n\0');

                } else if (frame.startsWith('SUBSCRIBE')) {
                    const dest  = this.getHeader(frame, 'destination:');
                    const subId = this.getHeader(frame, 'id:');
                    if (dest && subId) this.sessions.get(ws)?.subscriptions.set(dest, subId);

                } else if (frame.startsWith('SEND')) {
                    const bodyStart = frame.indexOf('\n\n') + 2;
                    const bodyEnd   = frame.lastIndexOf('\0');
                    const message   = JSON.parse(frame.slice(bodyStart, bodyEnd)) as any;

                    // Always enforce authenticated sender — never trust client payload
                    message.sender = username;

                    switch (message.type) {
                        case 'CHAT':
                            // Spam protection — max 30 messages/minute per user
                            if (!this.checkRateLimit(username)) {
                                ws.send('ERROR\nmessage:Rate limit exceeded. Slow down.\n\n\0');
                                return;
                            }
                            // Block check — don't deliver if recipient has blocked sender
                            if (message.recipient) {
                                const isBlocked = await this.env.DB.prepare(
                                    'SELECT id FROM blocked_users WHERE blocker=? AND blocked=?'
                                ).bind(message.recipient, username).first();
                                if (isBlocked) return; // silently drop — don't reveal block to sender
                            }
                            await this.persistAndBroadcastChat(message);
                            break;
                        case 'TYPING':
                            // Typing indicators are ephemeral — no persistence, no rate limit
                            this.broadcastTyping(message);
                            break;
                        default:
                            // Unknown type — silently ignore
                            break;
                    }

                } else if (frame.startsWith('DISCONNECT')) {
                    ws.close(1000, 'Client disconnected');
                }

            } catch (err) {
                console.error('[DO] Frame error:', err);
                try { ws.send('ERROR\nmessage:Invalid frame\n\n\0'); } catch { /* closed */ }
            }
        });

        ws.addEventListener('close', async () => {
            this.sessions.delete(ws);
            await this.setOnlineStatus(username, false);
            this.broadcastPresence(username, false);
        });

        ws.addEventListener('error', async () => {
            this.sessions.delete(ws);
            await this.setOnlineStatus(username, false);
        });
    }

    // ── Persistence helpers ───────────────────────────────────────────────────

    async setOnlineStatus(username: string, online: boolean): Promise<void> {
        try {
            await this.env.DB.prepare(
                'UPDATE users SET is_online=?, last_active=CURRENT_TIMESTAMP WHERE username=?'
            ).bind(online ? 1 : 0, username).run();
        } catch (e) { console.error('[DO] setOnlineStatus:', e); }
    }

    async persistAndBroadcastChat(message: any): Promise<void> {
        message.timestamp = Date.now();

        try {
            if (message.groupId) {
                // ── Group message ──────────────────────────────────────────────
                const result = await this.env.DB.prepare(
                    'INSERT INTO messages (sender, group_id, content, type, reply_to_id) VALUES (?,?,?,?,?)'
                ).bind(message.sender, message.groupId, message.content, 'CHAT', message.replyToId ?? null).run();
                message.id = result.meta.last_row_id;

                // Increment unread counts for all group members except sender
                const members = await this.env.DB.prepare(
                    'SELECT username FROM group_members WHERE group_id=? AND username!=?'
                ).bind(message.groupId, message.sender).all();

                if (members.results.length > 0) {
                    const chatId = `group:${message.groupId}`;
                    await this.env.DB.batch(
                        members.results.map((m: any) =>
                            this.env.DB.prepare(`
                                INSERT INTO unread_counts (username, chat_id, count) VALUES (?,?,1)
                                ON CONFLICT(username, chat_id) DO UPDATE SET count=count+1
                            `).bind(m.username, chatId)
                        )
                    );
                }

            } else if (message.recipient) {
                // ── Private message ────────────────────────────────────────────
                const result = await this.env.DB.prepare(
                    'INSERT INTO messages (sender, recipient, content, type, reply_to_id) VALUES (?,?,?,?,?)'
                ).bind(message.sender, message.recipient, message.content, 'CHAT', message.replyToId ?? null).run();
                message.id = result.meta.last_row_id;

                // Increment unread count for recipient
                const chatId = `user:${message.sender}`;
                await this.env.DB.prepare(`
                    INSERT INTO unread_counts (username, chat_id, count) VALUES (?,?,1)
                    ON CONFLICT(username, chat_id) DO UPDATE SET count=count+1
                `).bind(message.recipient, chatId).run();
            }
        } catch (e) {
            console.error('[DO] persistChat error:', e);
        }

        this.dispatchEvent(message);
    }

    // ── Real-time dispatch ────────────────────────────────────────────────────

    /**
     * Route an event to the correct connected subscribers.
     * Handles: CHAT, TYPING, MESSAGE_EDITED, MESSAGE_DELETED,
     *          READ_RECEIPT, ONLINE_STATUS
     */
    dispatchEvent(message: any): void {
        const payload = JSON.stringify(message);

        for (const [ws, info] of this.sessions.entries()) {
            const isRecipient = message.recipient === info.username;
            const isSender    = message.sender    === info.username;

            // Private channel (direct messages, typing, receipts, status)
            if (isRecipient || isSender) {
                const subId = info.subscriptions.get('/user/queue/private');
                if (subId) this.sendStomp(ws, '/user/queue/private', subId, payload);
            }

            // Group channel
            if (message.groupId) {
                const topic = `/topic/group.${message.groupId}`;
                const subId = info.subscriptions.get(topic);
                if (subId) this.sendStomp(ws, topic, subId, payload);
            }
        }
    }

    broadcastPresence(username: string, online: boolean): void {
        const payload = JSON.stringify({
            type: 'ONLINE_STATUS',
            sender: username,
            isOnline: online,
            timestamp: Date.now(),
        });

        for (const [ws, info] of this.sessions.entries()) {
            if (info.username === username) continue;
            const subId = info.subscriptions.get('/user/queue/private');
            if (subId) this.sendStomp(ws, '/user/queue/private', subId, payload);
        }
    }

    broadcastTyping(message: any): void {
        const payload = JSON.stringify({ ...message, timestamp: Date.now() });

        for (const [ws, info] of this.sessions.entries()) {
            if (info.username === message.sender) continue; // don't echo back

            const isTarget = message.recipient === info.username;

            if (isTarget) {
                const subId = info.subscriptions.get('/user/queue/private');
                if (subId) this.sendStomp(ws, '/user/queue/private', subId, payload);
            }

            if (message.groupId) {
                const topic = `/topic/group.${message.groupId}`;
                const subId = info.subscriptions.get(topic);
                if (subId) this.sendStomp(ws, topic, subId, payload);
            }
        }
    }

    // ── STOMP utilities ───────────────────────────────────────────────────────

    getHeader(frame: string, name: string): string | null {
        for (const line of frame.split('\n')) {
            if (line.startsWith(name)) {
                const idx = line.indexOf(':');
                return idx !== -1 ? line.slice(idx + 1).trim() : null;
            }
        }
        return null;
    }

    sendStomp(ws: WebSocket, destination: string, subscriptionId: string, body: string): void {
        const frame = `MESSAGE\ndestination:${destination}\nsubscription:${subscriptionId}\ncontent-type:application/json\n\n${body}\0`;
        try {
            ws.send(frame);
        } catch {
            // Socket closed — purge stale session
            this.sessions.delete(ws);
        }
    }
}
