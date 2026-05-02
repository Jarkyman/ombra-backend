use sqlx::FromRow;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(FromRow, Clone)]
#[allow(dead_code)]
pub struct ProfileFact {
    pub id: String,
    pub key: String,
    pub value: String,
    pub source: String,
    pub created_at: i64,
}

pub async fn get_facts(pool: &DatabasePool) -> Result<Vec<ProfileFact>, OmbraError> {
    sqlx::query_as::<_, ProfileFact>("SELECT * FROM profile_facts ORDER BY key ASC")
        .fetch_all(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get profile facts: {e}")))
}

pub async fn upsert_fact(
    pool: &DatabasePool,
    key: &str,
    value: &str,
    source: &str,
) -> Result<(), OmbraError> {
    let id = format!("fact_{key}");
    let now = current_timestamp();

    sqlx::query(
        "INSERT INTO profile_facts (id, key, value, source, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET value = excluded.value, source = excluded.source",
    )
    .bind(&id)
    .bind(key)
    .bind(value)
    .bind(source)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("upsert profile fact: {e}")))?;

    Ok(())
}

pub async fn delete_fact(pool: &DatabasePool, key: &str) -> Result<(), OmbraError> {
    let id = format!("fact_{key}");

    sqlx::query("DELETE FROM profile_facts WHERE id = ?")
        .bind(&id)
        .execute(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("delete profile fact: {e}")))?;

    Ok(())
}

pub async fn upsert_facts(
    pool: &DatabasePool,
    facts: &[(String, String)],
    source: &str,
) -> Result<(), OmbraError> {
    for (key, value) in facts {
        if !value.trim().is_empty() {
            upsert_fact(pool, key, value, source).await?;
        }
    }
    Ok(())
}

fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
