CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT    PRIMARY KEY,
    started_at  INTEGER NOT NULL,
    ended_at    INTEGER,
    summary     TEXT
);

CREATE TABLE IF NOT EXISTS transcripts (
    id          TEXT    PRIMARY KEY,
    session_id  TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    recorded_at INTEGER NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
