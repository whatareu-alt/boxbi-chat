-- ============================================================
-- Boxbi Chat - Migration v3
-- ============================================================
-- WHO should run this:
--   - If you ran schema.sql (fresh DB): run this file as-is.
--     The new columns (invite_token, etc.) are already in schema.sql.
--   - If you are upgrading from an OLD v2 DB (before schema.sql was updated):
--     also uncomment and run the ALTER TABLE block at the bottom.
-- ============================================================

-- New tables (safe to run on any database)
CREATE TABLE IF NOT EXISTS blocked_users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker    TEXT NOT NULL,
    blocked    TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker, blocked)
);

CREATE TABLE IF NOT EXISTS message_reactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    username   TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, username, emoji)
);

CREATE TABLE IF NOT EXISTS pinned_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    pinned_by  TEXT NOT NULL,
    pinned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, message_id)
);

-- Indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker);
CREATE INDEX IF NOT EXISTS idx_reactions_msg   ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_pins_group      ON pinned_messages(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_token ON chat_groups(invite_token) WHERE invite_token IS NOT NULL;

-- ============================================================
-- ONLY for OLD v2 databases (before schema.sql was updated).
-- If you get "duplicate column" errors, your DB already has
-- these columns — skip this block.
-- ============================================================
-- ALTER TABLE chat_groups ADD COLUMN invite_token   TEXT;
-- ALTER TABLE chat_groups ADD COLUMN invite_enabled INTEGER DEFAULT 1;
-- ALTER TABLE chat_groups ADD COLUMN max_members    INTEGER DEFAULT 256;
