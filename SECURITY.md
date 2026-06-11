# Security Policy

## Reporting a vulnerability

If you find a security issue in Boxbi, please email **whatareu357@gmail.com**
with details. Please do not open a public issue for security reports.

## Security measures in place

- PBKDF2-SHA256 password hashing (100k iterations, per-user salt)
- JWT access tokens (24h) + rotating refresh tokens stored as SHA-256 hashes
- OTP brute-force protection and per-user email rate limiting
- Login lockout keyed by username + IP
- Server-side group membership checks on every WebSocket subscribe/send
- Timing-safe comparisons for OTPs and admin secrets
- Ephemeral data: messages auto-delete after 24h, accounts after 7 days
