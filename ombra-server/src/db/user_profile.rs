use sqlx::FromRow;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(Debug, FromRow, Clone)]
pub struct UserProfile {
    pub profile_summary: Option<String>,
}

pub async fn get_profile(pool: &DatabasePool) -> Result<Option<UserProfile>, OmbraError> {
    sqlx::query_as::<_, UserProfile>(
        "SELECT profile_summary FROM user_profile WHERE id = 'default'",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("get user profile: {e}")))
}

pub async fn create_default_profile(
    pool: &DatabasePool,
    created_at: i64,
) -> Result<(), OmbraError> {
    sqlx::query(
        "INSERT OR IGNORE INTO user_profile (id, created_at) VALUES ('default', ?)",
    )
    .bind(created_at)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("create default profile: {e}")))?;
    Ok(())
}

pub async fn update_profile_summary(
    pool: &DatabasePool,
    summary: &str,
) -> Result<(), OmbraError> {
    sqlx::query("UPDATE user_profile SET profile_summary = ? WHERE id = 'default'")
        .bind(summary)
        .execute(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("update profile summary: {e}")))?;
    Ok(())
}
