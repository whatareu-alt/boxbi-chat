# boxbi-chat

Real-time chat application: friends, direct messages, group chats, message
reactions, replies, editing/deletion, blocking, and email-OTP signup /
password reset.

## Architecture

| Concern | Implementation |
|---------|----------------|
| Backend / API | **Cloudflare Worker** — [`src/`](src/) (Hono) |
| Realtime | **Durable Object** `CHAT_DO` (WebSockets) — [`src/ChatDO.ts`](src/ChatDO.ts) |
| Database | **D1** (binding `DB`) — [`schema.sql`](schema.sql) |
| Frontend | [`public/`](public/) — served as Worker static assets |

### Code layout

```
src/
  index.ts          # app assembly: CORS, auth middleware, /ws, /admin/reset
  ChatDO.ts         # Durable Object: WebSocket sessions, STOMP, presence
  types.ts          # shared types + constants
  lib/
    crypto.ts       # password hashing, OTP, refresh tokens, LIKE escaping
    email.ts        # Resend.com sender + OTP email template
    util.ts         # requireAuth middleware, safeUser, wsBroadcast
  routes/
    auth.ts         # signup, OTP verify, login, password reset, refresh, logout
    users.ts        # profiles, search, sessions, block, avatar, delete account
    friends.ts      # friend requests
    groups.ts       # groups, members, invites, pins, group messages
    messages.ts     # DMs, search, edit/delete, reactions, read receipts
public/
  index.html        # markup
  style.css         # styles
  app.js            # frontend logic
```

## Develop

```bash
npm install
npm run dev        # wrangler dev — Worker + D1 + DO locally
```

## Database migrations

Fresh DB: run `schema.sql`. Existing DBs: apply `schema_migration_v2.sql` →
`v3` → `v4` in order (each is run once):

```bash
wrangler d1 execute boxbi-db --remote --file=schema_migration_v4.sql
```

## Deploy

```bash
npm run deploy     # wrangler deploy
```

## Secrets (production)

Set via Wrangler — never commit these:

```bash
wrangler secret put JWT_SECRET          # 32+ random chars
wrangler secret put ADMIN_RESET_SECRET  # 32+ random chars
wrangler secret put RESEND_API_KEY      # from resend.com, for real emails
```

For real email delivery the sending domain (`boxbi.online`) must be verified
in the Resend dashboard, otherwise sends fail silently (check Worker logs).
