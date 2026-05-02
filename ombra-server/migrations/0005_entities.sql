CREATE TABLE entities (
    id              TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    entity_type     TEXT    NOT NULL,
    first_seen      INTEGER NOT NULL,
    last_seen       INTEGER NOT NULL,
    encounter_count INTEGER NOT NULL DEFAULT 1,
    profile_summary TEXT
);

CREATE UNIQUE INDEX entities_name_idx ON entities (name);

CREATE TABLE entity_context_tags (
    entity_id TEXT NOT NULL,
    tag       TEXT NOT NULL,
    PRIMARY KEY (entity_id, tag)
);

CREATE TABLE entity_mentions (
    entity_id  TEXT NOT NULL,
    cluster_id TEXT NOT NULL,
    PRIMARY KEY (entity_id, cluster_id)
);

CREATE TABLE entity_relationships (
    entity_id         TEXT NOT NULL,
    related_entity_id TEXT NOT NULL,
    relationship_type TEXT NOT NULL,
    strength          REAL NOT NULL DEFAULT 0.1,
    PRIMARY KEY (entity_id, related_entity_id)
);
