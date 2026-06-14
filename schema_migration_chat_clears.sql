-- ============================================================
-- Migration: per-user "delete chat" support
-- Run against an existing Boxbi DB:
--   wrangler d1 execute boxbi-db --remote --file=./schema_migration_chat_clears.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_clears (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL,
    contact    TEXT NOT NULL,
    cleared_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, contact)
);

CREATE INDEX IF NOT EXISTS idx_chat_clears_user ON chat_clears(username);
