CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
