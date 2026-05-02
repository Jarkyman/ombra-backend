use sqlx::FromRow;
use uuid::Uuid;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(Debug, FromRow)]
pub struct Cluster {
    pub id: String,
    pub session_id: String,
    pub started_at: i64,
    pub closed_at: i64,
    pub event_type: String,
    pub relevance_score: f32,
    pub event_summary: String,
    pub language: String,
}

pub struct InsertClusterParams<'a> {
    pub session_id: &'a str,
    pub started_at: i64,
    pub closed_at: i64,
    pub event_type: &'a str,
    pub relevance_score: f32,
    pub event_summary: &'a str,
    pub language: &'a str,
}

#[cfg(test)]
pub async fn insert_cluster(
    pool: &DatabasePool,
    params: InsertClusterParams<'_>,
) -> Result<Cluster, OmbraError> {
    let id = Uuid::new_v4().to_string();

    sqlx::query_as::<_, Cluster>(
        "INSERT INTO clusters (id, session_id, started_at, closed_at, event_type, relevance_score, event_summary, language)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *",
    )
    .bind(&id)
    .bind(params.session_id)
    .bind(params.started_at)
    .bind(params.closed_at)
    .bind(params.event_type)
    .bind(params.relevance_score)
    .bind(params.event_summary)
    .bind(params.language)
    .fetch_one(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("insert cluster: {e}")))
}

pub async fn list_clusters(
    pool: &DatabasePool,
    limit: i64,
    offset: i64,
) -> Result<Vec<Cluster>, OmbraError> {
    sqlx::query_as::<_, Cluster>(
        "SELECT * FROM clusters WHERE flagged_at IS NULL ORDER BY started_at DESC LIMIT ? OFFSET ?",
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list clusters: {e}")))
}

pub async fn list_clusters_by_session(
    pool: &DatabasePool,
    session_id: &str,
) -> Result<Vec<Cluster>, OmbraError> {
    sqlx::query_as::<_, Cluster>(
        "SELECT * FROM clusters WHERE session_id = ? AND flagged_at IS NULL ORDER BY started_at ASC",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list clusters by session: {e}")))
}

pub async fn get_cluster_by_id(
    pool: &DatabasePool,
    id: &str,
) -> Result<Option<Cluster>, OmbraError> {
    sqlx::query_as::<_, Cluster>("SELECT * FROM clusters WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get cluster by id: {e}")))
}

pub async fn get_clusters_by_ids(
    pool: &DatabasePool,
    ids: &[String],
) -> Result<Vec<Cluster>, OmbraError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut qb = sqlx::QueryBuilder::new("SELECT * FROM clusters WHERE id IN (");
    let mut sep = qb.separated(", ");
    for id in ids {
        sep.push_bind(id);
    }
    sep.push_unseparated(")");
    qb.build_query_as::<Cluster>()
        .fetch_all(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get clusters by ids: {e}")))
}

pub async fn insert_cluster_with_transcripts(
    pool: &DatabasePool,
    params: InsertClusterParams<'_>,
    transcript_ids: &[String],
) -> Result<Cluster, OmbraError> {
    let id = Uuid::new_v4().to_string();
    let mut tx = pool
        .begin()
        .await
        .map_err(|e| OmbraError::Storage(format!("begin cluster transaction: {e}")))?;

    let cluster = sqlx::query_as::<_, Cluster>(
        "INSERT INTO clusters (id, session_id, started_at, closed_at, event_type, relevance_score, event_summary, language)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING *",
    )
    .bind(&id)
    .bind(params.session_id)
    .bind(params.started_at)
    .bind(params.closed_at)
    .bind(params.event_type)
    .bind(params.relevance_score)
    .bind(params.event_summary)
    .bind(params.language)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| OmbraError::Storage(format!("insert cluster: {e}")))?;

    if !transcript_ids.is_empty() {
        let mut qb = sqlx::QueryBuilder::new("UPDATE transcripts SET cluster_id = ");
        qb.push_bind(&id);
        qb.push(" WHERE id IN (");
        let mut sep = qb.separated(", ");
        for tid in transcript_ids {
            sep.push_bind(tid);
        }
        sep.push_unseparated(")");
        qb.build()
            .execute(&mut *tx)
            .await
            .map_err(|e| OmbraError::Storage(format!("assign transcripts to cluster: {e}")))?;
    }

    tx.commit()
        .await
        .map_err(|e| OmbraError::Storage(format!("commit cluster transaction: {e}")))?;

    Ok(cluster)
}

// ── Trash ──────────────────────────────────────────────────────────────────────

#[derive(FromRow)]
#[allow(dead_code)]
pub struct TrashedCluster {
    pub id: String,
    pub session_id: String,
    pub started_at: i64,
    pub closed_at: i64,
    pub event_type: String,
    pub relevance_score: f32,
    pub event_summary: String,
    pub language: String,
    pub flagged_at: i64,
    pub flagged_by: String,
}

pub async fn list_trashed_clusters(pool: &DatabasePool) -> Result<Vec<TrashedCluster>, OmbraError> {
    sqlx::query_as::<_, TrashedCluster>(
        "SELECT id, session_id, started_at, closed_at, event_type, relevance_score,
                event_summary, language, flagged_at, flagged_by
         FROM clusters
         WHERE flagged_at IS NOT NULL
         ORDER BY flagged_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list trashed clusters: {e}")))
}

pub async fn flag_cluster(
    pool: &DatabasePool,
    id: &str,
    flagged_by: &str,
) -> Result<bool, OmbraError> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let rows = sqlx::query(
        "UPDATE clusters SET flagged_at = ?, flagged_by = ? WHERE id = ? AND flagged_at IS NULL",
    )
    .bind(now)
    .bind(flagged_by)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("flag cluster: {e}")))?;

    Ok(rows.rows_affected() > 0)
}

pub async fn restore_cluster(pool: &DatabasePool, id: &str) -> Result<bool, OmbraError> {
    let rows = sqlx::query(
        "UPDATE clusters SET flagged_at = NULL, flagged_by = NULL WHERE id = ?",
    )
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("restore cluster: {e}")))?;

    Ok(rows.rows_affected() > 0)
}

pub async fn delete_cluster(pool: &DatabasePool, id: &str) -> Result<bool, OmbraError> {
    let rows = sqlx::query("DELETE FROM clusters WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("delete cluster: {e}")))?;

    Ok(rows.rows_affected() > 0)
}

pub async fn delete_all_trashed_clusters(pool: &DatabasePool) -> Result<i64, OmbraError> {
    let rows =
        sqlx::query("DELETE FROM clusters WHERE flagged_at IS NOT NULL")
            .execute(pool)
            .await
            .map_err(|e| OmbraError::Storage(format!("empty trash: {e}")))?;

    Ok(rows.rows_affected() as i64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_test_db;

    fn test_params(session_id: &str, started_at: i64) -> InsertClusterParams {
        InsertClusterParams {
            session_id,
            started_at,
            closed_at: started_at + 300,
            event_type: "conversation",
            relevance_score: 0.8,
            event_summary: "Test cluster summary.",
            language: "en",
        }
    }

    #[tokio::test]
    async fn insert_and_retrieve_cluster_by_id() {
        let pool = create_test_db().await;
        let inserted = insert_cluster(&pool, test_params("session-1", 1000)).await.unwrap();

        let retrieved = get_cluster_by_id(&pool, &inserted.id).await.unwrap().unwrap();
        assert_eq!(retrieved.id, inserted.id);
        assert_eq!(retrieved.event_summary, "Test cluster summary.");
        assert_eq!(retrieved.language, "en");
    }

    #[tokio::test]
    async fn get_cluster_by_id_returns_none_for_unknown_id() {
        let pool = create_test_db().await;
        let result = get_cluster_by_id(&pool, "nonexistent-id").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn list_clusters_returns_newest_first() {
        let pool = create_test_db().await;
        insert_cluster(&pool, test_params("session-1", 1000)).await.unwrap();
        insert_cluster(&pool, test_params("session-1", 3000)).await.unwrap();
        insert_cluster(&pool, test_params("session-1", 2000)).await.unwrap();

        let clusters = list_clusters(&pool, 10, 0).await.unwrap();
        assert_eq!(clusters.len(), 3);
        assert!(clusters[0].started_at >= clusters[1].started_at);
        assert!(clusters[1].started_at >= clusters[2].started_at);
    }

    #[tokio::test]
    async fn list_clusters_respects_limit_and_offset() {
        let pool = create_test_db().await;
        for i in 0..5 {
            insert_cluster(&pool, test_params("session-1", i * 1000)).await.unwrap();
        }

        let page_one = list_clusters(&pool, 2, 0).await.unwrap();
        let page_two = list_clusters(&pool, 2, 2).await.unwrap();

        assert_eq!(page_one.len(), 2);
        assert_eq!(page_two.len(), 2);
        assert_ne!(page_one[0].id, page_two[0].id);
    }

    #[tokio::test]
    async fn list_clusters_by_session_filters_correctly() {
        let pool = create_test_db().await;
        insert_cluster(&pool, test_params("session-a", 1000)).await.unwrap();
        insert_cluster(&pool, test_params("session-b", 2000)).await.unwrap();

        let result = list_clusters_by_session(&pool, "session-a").await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].session_id, "session-a");
    }
}
