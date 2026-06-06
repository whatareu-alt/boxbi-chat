# boxbi-chat

Real-time chat application: friends, direct messages, group chats, message
reactions, replies, editing/deletion, blocking, and email-OTP signup /
password reset.

## Architecture

| Concern | Canonical (production) | Status |
|---------|------------------------|--------|
| Backend / API | **Cloudflare Worker** — [`src/index.ts`](src/index.ts) (Hono) | ✅ Production |
| Realtime | **Durable Object** `CHAT_DO` (WebSockets) | ✅ Production |
| Database | **D1** (binding `DB`) | ✅ Production |
| Asset storage | **R2** (binding `R2_BUCKET`) | ✅ Production |
| Frontend | [`public/`](public/) — served as Worker static assets | ✅ Production |
| Alt. backend | [`server-spring/`](server-spring/) (Spring Boot) | ⚠️ **Deprecated — local dev only** |

In production the frontend talks to the Worker (it uses
`window.location.origin` as the API base). It only targets the Spring backend
(`http://localhost:8081`) during local development.

### Source of truth
- **Frontend:** [`public/index.html`](public/index.html) is canonical. The copy
  under [`server-spring/src/main/resources/static/`](server-spring/src/main/resources/static/)
  is only what the deprecated Spring backend serves locally — keep it in sync
  by copying from `public/` (do not edit it independently).
- **Backend:** the Cloudflare Worker. New features belong here. See the
  deprecation note in [`server-spring/README.md`](server-spring/README.md).

## Develop

```bash
npm install
npm run dev        # wrangler dev — Worker + D1 + DO locally
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
