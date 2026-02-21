export class ChatDO {
    state: DurableObjectState;
    env: any;
    sessions: Map<WebSocket, { username: string; subscriptions: Map<string, string> }>;

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
        this.sessions.set(ws, { username, subscriptions: new Map() });

        ws.addEventListener('message', async (msg) => {
            try {
                const data = msg.data as string;
                // Simple STOMP emulation
                // CONNECT, SUBSCRIBE, SEND, DISCONNECT

                if (data.startsWith('CONNECT')) {
                    ws.send('CONNECTED\nversion:1.1\n\n\0');
                } else if (data.startsWith('SUBSCRIBE')) {
                    const destination = this.getHeader(data, 'destination:');
                    const subId = this.getHeader(data, 'id:');
                    if (destination && subId) {
                        this.sessions.get(ws)?.subscriptions.set(destination, subId);
                        console.log(`[DO] User ${username} subscribed to ${destination} with id ${subId}`);
                    }
                } else if (data.startsWith('SEND')) {
                    const bodyStart = data.indexOf('\n\n') + 2;
                    const bodyEnd = data.lastIndexOf('\0');
                    const body = data.slice(bodyStart, bodyEnd);
                    const message = JSON.parse(body);
                    console.log(`[DO] Received SEND from ${username}:`, message.type, 'to', message.recipient || message.groupId);

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

    getHeader(data: string, headerName: string) {
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.startsWith(headerName)) {
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
            const isRecipient = message.recipient === info.username;
            const isSender = message.sender === info.username;

            // Check Private Signaling
            if (isRecipient || isSender) {
                const subId = info.subscriptions.get('/user/queue/private');
                if (subId) {
                    console.log(`[DO] Broadcasting ${message.type} to ${info.username} (Private, ID: ${subId})`);
                    this.sendStomp(ws, '/user/queue/private', subId, payload);
                }
            }

            // Check Group Messaging
            if (message.groupId) {
                const groupTopic = `/topic/group.${message.groupId}`;
                const subId = info.subscriptions.get(groupTopic);
                if (subId) {
                    console.log(`[DO] Broadcasting ${message.type} to ${info.username} (Group ${message.groupId}, ID: ${subId})`);
                    this.sendStomp(ws, groupTopic, subId, payload);
                }
            }
        }
    }

    sendStomp(ws: WebSocket, destination: string, subscriptionId: string, body: string) {
        const frame = `MESSAGE\ndestination:${destination}\nsubscription:${subscriptionId}\ncontent-type:application/json\n\n${body}\0`;
        ws.send(frame);
    }
}
