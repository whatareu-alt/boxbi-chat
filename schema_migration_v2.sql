-- ============================================================
-- Boxbi Chat - Migration v2
-- Run this ONCE on an existing v1 database.
-- Safe to run: all statements use IF NOT EXISTS / IF column doesn't exist.
-- ============================================================

-- Add new columns to users
ALTER TABLE users ADD COLUMN bio                 TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN profile_picture_url TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN is_online           INTEGER DEFAULT 0;

-- Add new columns to messages
ALTER TABLE messages ADD COLUMN reply_to_id INTEGER;
ALTER TABLE messages ADD COLUMN is_deleted   INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN is_edited    INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN edited_at    DATETIME;

-- Add description + role columns
ALTER TABLE chat_groups  ADD COLUMN description TEXT DEFAULT '';
ALTER TABLE group_members ADD COLUMN role       TEXT DEFAULT 'MEMBER';

-- New tables
CREATE TABLE IF NOT EXISTS message_reads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    username   TEXT NOT NULL,
    read_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, username)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS login_attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    attempts     INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unread_counts (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    chat_id  TEXT NOT NULL,
    count    INTEGER DEFAULT 0,
    UNIQUE(username, chat_id)
);

-- New indexes
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_content   ON messages(content);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(username);
CREATE INDEX IF NOT EXISTS idx_unread_username    ON unread_counts(username);
CREATE INDEX IF NOT EXISTS idx_message_reads_msg  ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts     ON login_attempts(username);
