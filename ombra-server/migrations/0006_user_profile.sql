CREATE TABLE user_profile (
    id               TEXT    PRIMARY KEY DEFAULT 'default',
    name             TEXT,
    occupation       TEXT,
    location         TEXT,
    important_people TEXT,
    current_projects TEXT,
    additional       TEXT,
    profile_summary  TEXT,
    created_at       INTEGER NOT NULL
);
