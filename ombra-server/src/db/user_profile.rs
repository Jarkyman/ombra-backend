// TODO(future): replace fixed-column UserProfile with a dynamic `profile_facts` table:
//   (id TEXT PK, key TEXT, value TEXT, source TEXT, created_at INTEGER)
// This allows Ombra to write new facts from conversations automatically, and the admin
// panel to surface arbitrary growing context rather than just the 6 onboarding fields.
// Requires: migration, new GET/PATCH /profile endpoints, summary regeneration endpoint.

use sqlx::FromRow;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(Debug, FromRow, Clone)]
pub struct UserProfile {
    pub name: Option<String>,
    pub occupation: Option<String>,
    pub location: Option<String>,
    pub important_people: Option<String>,
    pub current_projects: Option<String>,
    pub additional: Option<String>,
    pub profile_summary: Option<String>,
}

pub struct InsertUserProfileParams {
    pub name: Option<String>,
    pub occupation: Option<String>,
    pub location: Option<String>,
    pub important_people: Option<String>,
    pub current_projects: Option<String>,
    pub additional: Option<String>,
    pub created_at: i64,
}

pub async fn get_profile(pool: &DatabasePool) -> Result<Option<UserProfile>, OmbraError> {
    sqlx::query_as::<_, UserProfile>("SELECT * FROM user_profile WHERE id = 'default'")
        .fetch_optional(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get user profile: {e}")))
}

pub async fn insert_profile(
    pool: &DatabasePool,
    params: InsertUserProfileParams,
) -> Result<UserProfile, OmbraError> {
    sqlx::query_as::<_, UserProfile>(
        "INSERT INTO user_profile
             (id, name, occupation, location, important_people, current_projects, additional, created_at)
         VALUES ('default', ?, ?, ?, ?, ?, ?, ?)
         RETURNING *",
    )
    .bind(&params.name)
    .bind(&params.occupation)
    .bind(&params.location)
    .bind(&params.important_people)
    .bind(&params.current_projects)
    .bind(&params.additional)
    .bind(params.created_at)
    .fetch_one(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("insert user profile: {e}")))
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
