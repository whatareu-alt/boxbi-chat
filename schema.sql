-- Boxbi Chat D1 Schema
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Messages table (Private and Group)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    recipient TEXT,
    -- NULL for group messages
    group_id INTEGER,
    -- NULL for private messages
    content TEXT NOT NULL,
    type TEXT DEFAULT 'CHAT',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender) REFERENCES users(username)
);
-- Friend Requests table
CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_username TEXT NOT NULL,
    receiver_username TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    -- PENDING, ACCEPTED, REJECTED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_username, receiver_username)
);
-- Chat Groups table
CREATE TABLE IF NOT EXISTS chat_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(username)
);
-- Group Members table
CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(group_id) REFERENCES chat_groups(id),
    FOREIGN KEY(username) REFERENCES users(username),
    UNIQUE(group_id, username)
);
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender, recipient);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE INDEX IF NOT EXISTS idx_friends_sender ON friend_requests(sender_username);
CREATE INDEX IF NOT EXISTS idx_friends_receiver ON friend_requests(receiver_username);