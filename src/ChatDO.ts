export class ChatDO {
    state: DurableObjectState;
    env: any;
    sessions: Map<WebSocket, { username: string; subscriptions: Set<string> }>;

    constructor(state: DurableObjectState, env: any) {
        this.state = state;
        this.env = env;
        this.sessions = new Map();
    }

    async fetch(request: Request) {
        const pair = new WebSocketPair();
        const client = pair[0];
        const server = pair[1];

        const url = new URL(request.url);
        const username = url.searchParams.get('username') || 'Anonymous';

        await this.handleSession(server, username);

        // @ts-ignore - webSocket is a valid Cloudflare-specific ResponseInit property
        return new Response(null, { status: 101, webSocket: client });
    }

    async handleSession(ws: WebSocket, username: string) {
        ws.accept();
        this.sessions.set(ws, { username, subscriptions: new Set() });

        ws.addEventListener('message', async (msg) => {
            try {
                const data = msg.data as string;
                // Simple STOMP emulation
                // CONNECT, SUBSCRIBE, SEND, DISCONNECT

                // This is a very simplified handler. 
                // For a full STOMP support, we'd need a parser.
                // Let's assume the frontend sends JSON that we can map to STOMP-like actions.

                if (data.startsWith('CONNECT')) {
                    ws.send('CONNECTED\nversion:1.1\n\n\0');
                } else if (data.startsWith('SUBSCRIBE')) {
                    const destination = this.getDestination(data);
                    if (destination) {
                        this.sessions.get(ws)?.subscriptions.add(destination);
                    }
                } else if (data.startsWith('SEND')) {
                    const bodyStart = data.indexOf('\n\n') + 2;
                    const bodyEnd = data.lastIndexOf('\0');
                    const body = data.slice(bodyStart, bodyEnd);
                    const message = JSON.parse(body);

                    await this.broadcast(message);
                }
            } catch (e) {
                console.error('DO error:', e);
            }
        });

        ws.addEventListener('close', () => {
            this.sessions.delete(ws);
        });
    }

    getDestination(data: string) {
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.startsWith('destination:')) {
                return line.split(':')[1].trim();
            }
        }
        return null;
    }

    async broadcast(message: any) {
        const timestamp = new Date().toISOString();
        message.timestamp = Date.now();

        // Persist to D1 - Only for actual chat messages
        if (message.type === 'CHAT') {
            if (message.groupId) {
                await this.env.DB.prepare(
                    'INSERT INTO messages (sender, group_id, content, type) VALUES (?, ?, ?, ?)'
                ).bind(message.sender, message.groupId, message.content, message.type).run();
            } else if (message.recipient) {
                await this.env.DB.prepare(
                    'INSERT INTO messages (sender, recipient, content, type) VALUES (?, ?, ?, ?)'
                ).bind(message.sender, message.recipient, message.content, message.type).run();
            }
        }

        const payload = JSON.stringify(message);

        for (const [ws, info] of this.sessions.entries()) {
            // Check if user is subscribed to the topic or queue
            const isRecipient = message.recipient === info.username;
            const isSender = message.sender === info.username;
            const isGroupMember = message.groupId && info.subscriptions.has(`/topic/group.${message.groupId}`);
            const isPrivateSub = info.subscriptions.has('/user/queue/private');

            if ((isRecipient || isSender) && isPrivateSub) {
                this.sendStomp(ws, '/user/queue/private', payload);
            } else if (isGroupMember) {
                this.sendStomp(ws, `/topic/group.${message.groupId}`, payload);
            }
        }
    }

    sendStomp(ws: WebSocket, destination: string, body: string) {
        const frame = `MESSAGE\ndestination:${destination}\ncontent-type:application/json\n\n${body}\0`;
        ws.send(frame);
    }
}
