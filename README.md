# Boxbi Messenger

**Live: [boxbi.online](https://boxbi.online)**

Real-time chat application built on Cloudflare's edge platform — friends,
direct messages, group chats with invite links, message reactions, replies,
editing/deletion, read receipts, typing indicators, blocking, and OTP-based
password reset. No frameworks on the frontend, no servers to manage on the
backend.

## Screenshots

| Login & Signup | Chat | Groups |
|---|---|---|
| ![Login](docs/screenshots/login.png) | ![Chat](docs/screenshots/chat.png) | ![Groups](docs/screenshots/groups.png) |

## Features

- **Real-time messaging** — WebSockets via Cloudflare Durable Objects with a STOMP-style protocol; typing indicators, presence (online/offline), read receipts
- **Auth from scratch** — PBKDF2 password hashing (WebCrypto), JWT access tokens + rotating refresh tokens (multi-device, revocable sessions), OTP-based password reset via email
- **Groups** — roles (admin/member), shareable invite links with enable/disable/reset, pinned messages, member management
- **Messages** — replies, edit/soft-delete, emoji reactions, full-text search, cursor-based pagination, per-chat unread counts
- **Safety** — user blocking, login lockout, per-user message rate limiting
- **Disappearing messages** — hourly cron auto-deletes anything older than 24 hours (plus expired tokens/OTPs)
- **Ephemeral accounts** — every account fully expires 7 days after signup (rolling), with complete data cascade and empty-group cleanup

## Security

I performed a security audit on this codebase and fixed the following
vulnerabilities:

| Issue | Fix |
|---|---|
| Any authenticated user could read/post to **any group's live WebSocket channel** | Server-side membership checks on both `SUBSCRIBE` and `SEND` in the Durable Object |
| **OTP brute-forcing** — unlimited attempts on 6-digit reset codes | Codes invalidated after 5 wrong attempts |
| **Email bombing** — unlimited OTP emails per address | 60-second resend cooldown per user/email |
| **Account-lockout DoS** — attacker could lock any victim's account remotely | Lockout keyed by username + IP instead of username alone |
| **Account takeover vector** via unvalidated email change | Uniqueness check + safe error handling on profile update |
| **Data leak** — reactions endpoint exposed data for any message ID | Sender/recipient/group-membership access check |

Other hardening already in place: timing-safe comparisons for OTPs and admin
secrets, refresh tokens stored as SHA-256 hashes, JWT-verified WebSocket
upgrade, CORS allow-list, LIKE-wildcard escaping in search, and silent-drop
delivery for blocked users.

## Architecture

| Concern | Implementation |
|---------|----------------|
| Backend / API | **Cloudflare Worker** — [`src/`](src/) (Hono, TypeScript) |
| Realtime | **Durable Object** `CHAT_DO` — [`src/ChatDO.ts`](src/ChatDO.ts) |
| Database | **D1** (SQLite at the edge) — [`schema.sql`](schema.sql) |
| Transactional email | **Resend** (OTP delivery) |
| Frontend | Vanilla HTML/CSS/JS — [`public/`](public/), served as Worker static assets |

```
src/
  index.ts          # app assembly: CORS, auth middleware, /ws, /admin/reset
  ChatDO.ts         # Durable Object: WebSocket sessions, presence, rate limiting
  types.ts          # shared types + constants
  lib/
    crypto.ts       # PBKDF2 hashing, OTP, refresh tokens, LIKE escaping
    email.ts        # Resend sender + OTP email template
    util.ts         # requireAuth middleware, safeUser, wsBroadcast
  routes/
    auth.ts         # signup, OTP verify, login, password reset, refresh, logout
    users.ts        # profiles, search, sessions, block, delete account
    friends.ts      # friend requests
    groups.ts       # groups, members, invites, pins, group messages
    messages.ts     # DMs, search, edit/delete, reactions, read receipts
```

## Roadmap

- **Email verification on signup** (OTP) — flow is built and tested; will be
  re-enabled once the sending domain is fully verified for reliable delivery
- **Sign in with Google** (OAuth / Google Identity Services)
- **Avatar uploads** (profile pictures)
- **Cloudflare Turnstile** (CAPTCHA) on signup
- Automated tests (Vitest + Workers pool)

## Develop

```bash
npm install
npm run dev        # wrangler dev — Worker + D1 + DO locally
```

## Database migrations

Fresh DB: run `schema.sql`. Existing DBs: apply `schema_migration_v2.sql` →
`v3` → `v4` in order:

```bash
npx wrangler d1 execute boxbi-db --remote --file=schema_migration_v4.sql
```

## Deploy

```bash
npm run deploy     # wrangler deploy
```

## Secrets (production)

Set via Wrangler — never commit these:

```bash
npx wrangler secret put JWT_SECRET          # 32+ random chars
npx wrangler secret put ADMIN_RESET_SECRET  # 32+ random chars
npx wrangler secret put RESEND_API_KEY      # from resend.com, for real emails
```

For real email delivery the sending domain must be verified in the Resend
dashboard, otherwise sends fail silently (check Worker logs).
