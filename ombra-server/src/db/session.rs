use sqlx::FromRow;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(Debug, FromRow)]
pub struct SessionSummary {
    pub session_id: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub transcript_count: i64,
    pub cluster_count: i64,
}

pub async fn list_sessions(pool: &DatabasePool) -> Result<Vec<SessionSummary>, OmbraError> {
    sqlx::query_as::<_, SessionSummary>(
        "SELECT
             t.session_id,
             MIN(t.recorded_at)        AS first_seen,
             MAX(t.recorded_at)        AS last_seen,
             COUNT(DISTINCT t.id)      AS transcript_count,
             COUNT(DISTINCT c.id)      AS cluster_count
         FROM transcripts t
         LEFT JOIN clusters c ON c.session_id = t.session_id
         GROUP BY t.session_id
         ORDER BY last_seen DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list sessions: {e}")))
}
