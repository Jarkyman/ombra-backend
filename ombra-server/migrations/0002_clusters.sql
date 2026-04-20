CREATE TABLE IF NOT EXISTS clusters (
    id              TEXT    PRIMARY KEY,
    session_id      TEXT    NOT NULL,
    started_at      INTEGER NOT NULL,
    closed_at       INTEGER NOT NULL,
    event_type      TEXT    NOT NULL,
    relevance_score REAL    NOT NULL,
    event_summary   TEXT    NOT NULL,
    language        TEXT    NOT NULL DEFAULT 'unknown'
);

ALTER TABLE transcripts ADD COLUMN cluster_id TEXT;
