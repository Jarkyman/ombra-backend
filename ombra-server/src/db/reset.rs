use ombra_common::error::OmbraError;

use super::DatabasePool;

pub async fn purge_memories(pool: &DatabasePool) -> Result<(), OmbraError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| OmbraError::Storage(format!("begin transaction: {e}")))?;

    for table in &["entity_mentions", "clusters", "transcripts", "sessions"] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await
            .map_err(|e| OmbraError::Storage(format!("delete {table}: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|e| OmbraError::Storage(format!("commit purge: {e}")))?;

    tracing::info!(component = "admin", "memories purged");
    Ok(())
}

pub async fn factory_reset(pool: &DatabasePool) -> Result<(), OmbraError> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| OmbraError::Storage(format!("begin transaction: {e}")))?;

    for table in &[
        "entity_mentions",
        "entity_relationships",
        "entity_context_tags",
        "entities",
        "clusters",
        "transcripts",
        "sessions",
        "profile_facts",
        "user_profile",
    ] {
        sqlx::query(&format!("DELETE FROM {table}"))
            .execute(&mut *tx)
            .await
            .map_err(|e| OmbraError::Storage(format!("delete {table}: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|e| OmbraError::Storage(format!("commit factory reset: {e}")))?;

    tracing::info!(component = "admin", "factory reset complete");
    Ok(())
}
