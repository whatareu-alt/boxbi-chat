-- ============================================================
-- Boxbi Chat - Migration v3
-- Run ONCE on an existing v2 database.
-- ============================================================

-- Block/unblock users
CREATE TABLE IF NOT EXISTS blocked_users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    blocker    TEXT NOT NULL,
    blocked    TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(blocker, blocked)
);

-- Emoji reactions on messages
CREATE TABLE IF NOT EXISTS message_reactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    username   TEXT NOT NULL,
    emoji      TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, username, emoji)
);

-- Pinned messages in groups
CREATE TABLE IF NOT EXISTS pinned_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    pinned_by  TEXT NOT NULL,
    pinned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, message_id)
);

-- Group invite links + member limit
ALTER TABLE chat_groups ADD COLUMN invite_token  TEXT;
ALTER TABLE chat_groups ADD COLUMN invite_enabled INTEGER DEFAULT 1;
ALTER TABLE chat_groups ADD COLUMN max_members    INTEGER DEFAULT 256;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blocked_blocker   ON blocked_users(blocker);
CREATE INDEX IF NOT EXISTS idx_reactions_msg     ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_pins_group        ON pinned_messages(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_token ON chat_groups(invite_token) WHERE invite_token IS NOT NULL;
