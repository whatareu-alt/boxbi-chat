# server-spring — ⚠️ DEPRECATED (local dev only)

> **This Spring Boot backend is not the production backend and is not deployed.**
> Production runs on the Cloudflare Worker ([`../src/index.ts`](../src/index.ts))
> with D1, Durable Objects, and R2. See the [root README](../README.md).
>
> **Do not add new features here** — they will not reach production, and you'd be
> duplicating work already done (or to be done) in the Worker. This module is
> kept only as a local-development / reference implementation.
>
> If you fix a security issue or bug, fix it in the Worker too (the Worker is
> canonical). The frontend served from
> [`src/main/resources/static/`](src/main/resources/static/) is a copy of
> [`../public/`](../public/) — sync it from there, don't edit it independently.

## Run locally

```bash
mvn clean install
mvn spring-boot:run     # starts on http://localhost:8081
```

Uses an in-memory H2 database by default (data is cleared on restart).

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | JWT signing key (32+ bytes). If unset, an ephemeral random key is generated at startup (dev only). |
| `ADMIN_RESET_SECRET` | Enables the `/admin/*` endpoints. If unset, those endpoints are disabled (return 503). |
