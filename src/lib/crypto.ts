// ─── Crypto helpers ───────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
    const enc  = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const buf  = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
    return `pbkdf2:${bufToHex(salt)}:${bufToHex(new Uint8Array(buf))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    if (!stored?.startsWith('pbkdf2:')) return false;
    const [, saltHex, hashHex] = stored.split(':');
    const salt = hexToBuf(saltHex);
    const enc  = new TextEncoder();
    const key  = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const buf  = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
    return timingSafeEqual(bufToHex(new Uint8Array(buf)), hashHex);
}

export function bufToHex(buf: Uint8Array): string {
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBuf(hex: string): Uint8Array {
    const pairs = hex.match(/.{2}/g);
    if (!pairs) throw new Error('Invalid hex');
    return new Uint8Array(pairs.map(b => parseInt(b, 16)));
}

export function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

/** Escape %, _ and \ so user input can't act as LIKE wildcards */
export function escapeLike(s: string): string {
    return s.replace(/[\\%_]/g, (ch) => '\\' + ch);
}

export function generateOtp(): string {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return String(100000 + (a[0] % 900000));
}

export async function generateRefreshToken(): Promise<{ token: string; hash: string }> {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = bufToHex(bytes);
    const hash  = bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
    return { token, hash };
}

export async function hashRefreshToken(rawToken: string): Promise<string> {
    const bytes = hexToBuf(rawToken);
    return bufToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}
