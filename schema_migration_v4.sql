-- ============================================================
-- Boxbi Chat - Migration v4
-- OTP brute-force protection + resend cooldown.
-- Run ONCE on an existing database:
--   wrangler d1 execute boxbi-db --remote --file=schema_migration_v4.sql
-- (If you get "duplicate column" errors, the column already exists — skip.)
-- ============================================================

ALTER TABLE otp_verifications   ADD COLUMN attempts   INTEGER DEFAULT 0;
ALTER TABLE otp_verifications   ADD COLUMN created_at DATETIME;
ALTER TABLE password_reset_otps ADD COLUMN attempts   INTEGER DEFAULT 0;
ALTER TABLE password_reset_otps ADD COLUMN created_at DATETIME;

-- login_attempts.username now stores "username|ip" keys (no schema change
-- needed, but old per-username rows are stale — clear them):
DELETE FROM login_attempts;
