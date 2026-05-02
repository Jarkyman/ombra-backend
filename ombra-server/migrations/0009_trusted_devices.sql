CREATE TABLE IF NOT EXISTS trusted_devices (
    cn          TEXT    NOT NULL PRIMARY KEY,
    label       TEXT    NOT NULL DEFAULT '',
    first_seen  INTEGER NOT NULL,
    last_seen   INTEGER NOT NULL,
    revoked_at  INTEGER
);
