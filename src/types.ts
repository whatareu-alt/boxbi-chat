// ─── Shared types & constants ─────────────────────────────────────────────────

export type Bindings = {
    DB: D1Database;
    JWT_SECRET: string;
    CHAT_DO: DurableObjectNamespace;
    ADMIN_RESET_SECRET: string;
    RESEND_API_KEY?: string;       // Optional: real email via Resend.com
    R2_BUCKET?: R2Bucket;          // Optional: avatar uploads via Cloudflare R2
};

export type JWTPayload = { sub: string; iat: number; exp: number };

export const ALLOWED_ORIGINS = [
    'https://boxbi.online',
    'https://www.boxbi.online',
    'https://boxbichat.netlify.app',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
];

export const MAX_LOGIN_ATTEMPTS     = 5;
export const LOCKOUT_MINUTES        = 15;
export const MAX_OTP_ATTEMPTS       = 5;            // wrong OTP entries before the code is invalidated
export const OTP_RESEND_COOLDOWN_MS = 60_000;       // min gap between OTP emails per user
export const ACCESS_TOKEN_TTL_SEC   = 86_400;       // 24 hours
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const MAX_DEVICES            = 5;            // refresh tokens kept per user
