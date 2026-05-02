CREATE TABLE IF NOT EXISTS profile_facts (
    id          TEXT    NOT NULL PRIMARY KEY,
    key         TEXT    NOT NULL,
    value       TEXT    NOT NULL,
    source      TEXT    NOT NULL DEFAULT 'user',
    created_at  INTEGER NOT NULL
);

-- Migrate existing onboarding answers from fixed user_profile columns to facts
INSERT OR IGNORE INTO profile_facts (id, key, value, source, created_at)
    SELECT 'fact_name', 'name', name,
           'onboarding', COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER))
    FROM user_profile
    WHERE id = 'default' AND name IS NOT NULL AND name != '';

INSERT OR IGNORE INTO profile_facts (id, key, value, source, created_at)
    SELECT 'fact_occupation', 'occupation', occupation,
           'onboarding', COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER))
    FROM user_profile
    WHERE id = 'default' AND occupation IS NOT NULL AND occupation != '';

INSERT OR IGNORE INTO profile_facts (id, key, value, source, created_at)
    SELECT 'fact_location', 'location', location,
           'onboarding', COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER))
    FROM user_profile
    WHERE id = 'default' AND location IS NOT NULL AND location != '';

INSERT OR IGNORE INTO profile_facts (id, key, value, source, created_at)
    SELECT 'fact_important_people', 'important_people', important_people,
           'onboarding', COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER))
    FROM user_profile
    WHERE id = 'default' AND important_people IS NOT NULL AND important_people != '';

INSERT OR IGNORE INTO profile_facts (id, key, value, source, created_at)
    SELECT 'fact_current_projects', 'current_projects', current_projects,
           'onboarding', COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER))
    FROM user_profile
    WHERE id = 'default' AND current_projects IS NOT NULL AND current_projects != '';

INSERT OR IGNORE INTO profile_facts (id, key, value, source, created_at)
    SELECT 'fact_additional', 'additional', additional,
           'onboarding', COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER))
    FROM user_profile
    WHERE id = 'default' AND additional IS NOT NULL AND additional != '';
