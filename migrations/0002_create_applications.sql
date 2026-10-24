CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id INTEGER NOT NULL,
    parent_name TEXT NOT NULL,
    child_name TEXT NOT NULL,
    child_age TEXT,
    direction TEXT NOT NULL CHECK(direction IN ('ИИ', 'Программирование', 'Не определились')),
    about_child TEXT,
    preferred_time TEXT,
    contact_method TEXT,
    email TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (telegram_id) REFERENCES users (telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_applications_telegram_id ON applications (telegram_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications (created_at);
