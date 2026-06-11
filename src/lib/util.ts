import { jwt } from 'hono/jwt';
import type { Bindings, JWTPayload } from '../types';

// ─── Auth middleware ──────────────────────────────────────────────────────────

export const requireAuth = (c: any, next: any) =>
    jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, next);

// ─── Response helpers ─────────────────────────────────────────────────────────

export function safeUser(user: any) {
    const { password_hash, secret, ...safe } = user;
    return safe;
}

export function getAuthUser(c: any): string {
    return (c.get('jwtPayload') as JWTPayload).sub;
}

// ─── Internal WS broadcast helper ────────────────────────────────────────────

export async function wsBroadcast(env: Bindings, message: object): Promise<void> {
    const id = env.CHAT_DO.idFromName('global-chat');
    await env.CHAT_DO.get(id).fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
    }));
}
