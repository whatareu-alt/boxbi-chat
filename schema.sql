-- ============================================================
-- Boxbi Chat - D1 Schema (v2)
-- Run this for fresh databases.
-- For existing DBs, run schema_migration_v2.sql instead.
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    username            TEXT UNIQUE NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    password_hash       TEXT NOT NULL,
    first_name          TEXT DEFAULT '',
    last_name           TEXT DEFAULT '',
    bio                 TEXT DEFAULT '',
    profile_picture_url TEXT DEFAULT '',
    is_online           INTEGER DEFAULT 0,
    last_active         DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages (private + group)
CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    sender      TEXT NOT NULL,
    recipient   TEXT,               -- NULL for group messages
    group_id    INTEGER,            -- NULL for private messages
    content     TEXT NOT NULL,
    type        TEXT DEFAULT 'CHAT',
    reply_to_id INTEGER,            -- id of the message being replied to
    is_deleted  INTEGER DEFAULT 0,
    is_edited   INTEGER DEFAULT 0,
    edited_at   DATETIME,
    timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender) REFERENCES users(username)
);

-- Per-message read receipts
CREATE TABLE IF NOT EXISTS message_reads (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    username   TEXT NOT NULL,
    read_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, username),
    FOREIGN KEY(message_id) REFERENCES messages(id),
    FOREIGN KEY(username)   REFERENCES users(username)
);

-- Friend Requests
CREATE TABLE IF NOT EXISTS friend_requests (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_username   TEXT NOT NULL,
    receiver_username TEXT NOT NULL,
    status            TEXT DEFAULT 'PENDING', -- PENDING | ACCEPTED | REJECTED
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_username, receiver_username)
);

-- Chat Groups
CREATE TABLE IF NOT EXISTS chat_groups (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    description    TEXT DEFAULT '',
    created_by     TEXT NOT NULL,
    invite_token   TEXT,
    invite_enabled INTEGER DEFAULT 1,
    max_members    INTEGER DEFAULT 256,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(username)
);

-- Group Members
CREATE TABLE IF NOT EXISTS group_members (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id  INTEGER NOT NULL,
    username  TEXT NOT NULL,
    role      TEXT DEFAULT 'MEMBER', -- MEMBER | ADMIN
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(group_id) REFERENCES chat_groups(id),
    FOREIGN KEY(username) REFERENCES users(username),
    UNIQUE(group_id, username)
);

-- OTP Verifications (signup)
CREATE TABLE IF NOT EXISTS otp_verifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    secret      TEXT NOT NULL,
    first_name  TEXT DEFAULT '',
    last_name   TEXT DEFAULT '',
    otp         TEXT NOT NULL,
    expiry_time DATETIME NOT NULL,
    attempts    INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Password Reset OTPs
CREATE TABLE IF NOT EXISTS password_reset_otps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    email       TEXT UNIQUE NOT NULL,
    otp         TEXT NOT NULL,
    expiry_time DATETIME NOT NULL,
    attempts    INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refresh Tokens (multi-device JWT refresh)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL, -- SHA-256 of the raw token
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(username) REFERENCES users(username)
);

-- Login Attempts (account lockout, keyed by "username|ip")
CREATE TABLE IF NOT EXISTS login_attempts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT UNIQUE NOT NULL,
    attempts     INTEGER DEFAULT 0,
    locked_until DATETIME,
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Blocked users
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

-- Pinned messages (groups)
CREATE TABLE IF NOT EXISTS pinned_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id   INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    pinned_by  TEXT NOT NULL,
    pinned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, message_id)
);

-- Unread message counts per user per chat
CREATE TABLE IF NOT EXISTS unread_counts (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    chat_id  TEXT NOT NULL, -- "user:<username>" or "group:<id>"
    count    INTEGER DEFAULT 0,
    UNIQUE(username, chat_id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_username        ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender, recipient);
CREATE INDEX IF NOT EXISTS idx_messages_group        ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp    ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_content      ON messages(content);  -- for search
CREATE INDEX IF NOT EXISTS idx_friends_sender        ON friend_requests(sender_username);
CREATE INDEX IF NOT EXISTS idx_friends_receiver      ON friend_requests(receiver_username);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user   ON refresh_tokens(username);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker       ON blocked_users(blocker);
CREATE INDEX IF NOT EXISTS idx_reactions_msg         ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_pins_group            ON pinned_messages(group_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_token   ON chat_groups(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unread_username       ON unread_counts(username);
CREATE INDEX IF NOT EXISTS idx_message_reads_msg     ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts        ON login_attempts(username);
