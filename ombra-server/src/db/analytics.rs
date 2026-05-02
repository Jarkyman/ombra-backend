use std::collections::HashMap;

use sqlx::FromRow;

use ombra_common::error::OmbraError;

use super::DatabasePool;

pub struct OverviewStats {
    pub total_transcripts: i64,
    pub total_clusters: i64,
    pub total_entities: i64,
    pub entities_with_profile: i64,
    pub db_size_bytes: i64,
}

pub async fn get_overview(pool: &DatabasePool) -> Result<OverviewStats, OmbraError> {
    let total_transcripts: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM transcripts")
        .fetch_one(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("count transcripts: {e}")))?;

    let total_clusters: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM clusters")
        .fetch_one(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("count clusters: {e}")))?;

    let total_entities: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entities")
        .fetch_one(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("count entities: {e}")))?;

    let entities_with_profile: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM entities WHERE profile_summary IS NOT NULL")
            .fetch_one(pool)
            .await
            .map_err(|e| OmbraError::Storage(format!("count entities with profile: {e}")))?;

    let page_count: i64 = sqlx::query_scalar("PRAGMA page_count")
        .fetch_one(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("pragma page_count: {e}")))?;

    let page_size: i64 = sqlx::query_scalar("PRAGMA page_size")
        .fetch_one(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("pragma page_size: {e}")))?;

    Ok(OverviewStats {
        total_transcripts,
        total_clusters,
        total_entities,
        entities_with_profile,
        db_size_bytes: page_count * page_size,
    })
}

pub struct DayActivity {
    pub date: String,
    pub clusters: i64,
    pub new_entities: i64,
    pub avg_relevance: f64,
}

#[derive(FromRow)]
struct ClusterDayRow {
    day: String,
    cluster_count: i64,
    avg_rel: Option<f64>,
}

#[derive(FromRow)]
struct EntityDayRow {
    day: String,
    entity_count: i64,
}

pub async fn get_activity(
    pool: &DatabasePool,
    cutoff: Option<i64>,
) -> Result<Vec<DayActivity>, OmbraError> {
    let cluster_rows: Vec<ClusterDayRow> = match cutoff {
        Some(ts) => sqlx::query_as(
            "SELECT date(started_at, 'unixepoch') AS day,
                    COUNT(*) AS cluster_count,
                    AVG(relevance_score) AS avg_rel
             FROM clusters
             WHERE started_at >= ?
             GROUP BY day
             ORDER BY day ASC",
        )
        .bind(ts)
        .fetch_all(pool)
        .await,
        None => sqlx::query_as(
            "SELECT date(started_at, 'unixepoch') AS day,
                    COUNT(*) AS cluster_count,
                    AVG(relevance_score) AS avg_rel
             FROM clusters
             GROUP BY day
             ORDER BY day ASC",
        )
        .fetch_all(pool)
        .await,
    }
    .map_err(|e| OmbraError::Storage(format!("activity cluster query: {e}")))?;

    let entity_rows: Vec<EntityDayRow> = match cutoff {
        Some(ts) => sqlx::query_as(
            "SELECT date(first_seen, 'unixepoch') AS day, COUNT(*) AS entity_count
             FROM entities
             WHERE first_seen >= ?
             GROUP BY day
             ORDER BY day ASC",
        )
        .bind(ts)
        .fetch_all(pool)
        .await,
        None => sqlx::query_as(
            "SELECT date(first_seen, 'unixepoch') AS day, COUNT(*) AS entity_count
             FROM entities
             GROUP BY day
             ORDER BY day ASC",
        )
        .fetch_all(pool)
        .await,
    }
    .map_err(|e| OmbraError::Storage(format!("activity entity query: {e}")))?;

    let mut entity_by_day: HashMap<String, i64> =
        entity_rows.into_iter().map(|r| (r.day, r.entity_count)).collect();

    let days = cluster_rows
        .into_iter()
        .map(|r| DayActivity {
            new_entities: entity_by_day.remove(&r.day).unwrap_or(0),
            avg_relevance: r.avg_rel.unwrap_or(0.0),
            date: r.day,
            clusters: r.cluster_count,
        })
        .collect();

    Ok(days)
}

#[derive(FromRow)]
pub struct TopEntityRow {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub encounter_count: i64,
}

#[derive(FromRow)]
pub struct EncounterBucketRow {
    pub bucket: String,
    pub count: i64,
}

pub struct EntityStats {
    pub top_entities: Vec<TopEntityRow>,
    pub entities_with_profile: i64,
    pub encounter_distribution: Vec<EncounterBucketRow>,
}

pub async fn get_entity_stats(pool: &DatabasePool) -> Result<EntityStats, OmbraError> {
    let top_entities = sqlx::query_as::<_, TopEntityRow>(
        "SELECT id, name, entity_type, encounter_count
         FROM entities
         ORDER BY encounter_count DESC
         LIMIT 10",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("top entities: {e}")))?;

    let entities_with_profile: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM entities WHERE profile_summary IS NOT NULL")
            .fetch_one(pool)
            .await
            .map_err(|e| OmbraError::Storage(format!("entities with profile: {e}")))?;

    let encounter_distribution = sqlx::query_as::<_, EncounterBucketRow>(
        "SELECT
           CASE
             WHEN encounter_count BETWEEN 1 AND 5   THEN '1-5'
             WHEN encounter_count BETWEEN 6 AND 20  THEN '6-20'
             WHEN encounter_count BETWEEN 21 AND 50 THEN '21-50'
             ELSE '51+'
           END AS bucket,
           COUNT(*) AS count
         FROM entities
         GROUP BY bucket
         ORDER BY MIN(encounter_count) ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("encounter distribution: {e}")))?;

    Ok(EntityStats {
        top_entities,
        entities_with_profile,
        encounter_distribution,
    })
}

#[derive(FromRow)]
pub struct LanguageRow {
    pub language: String,
    pub count: i64,
}

pub async fn get_language_distribution(
    pool: &DatabasePool,
) -> Result<Vec<LanguageRow>, OmbraError> {
    sqlx::query_as::<_, LanguageRow>(
        "SELECT language, COUNT(*) AS count
         FROM clusters
         GROUP BY language
         ORDER BY count DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("language distribution: {e}")))
}

#[derive(FromRow)]
pub struct EventTypeRow {
    pub event_type: String,
    pub count: i64,
}

pub async fn get_event_type_distribution(
    pool: &DatabasePool,
) -> Result<Vec<EventTypeRow>, OmbraError> {
    sqlx::query_as::<_, EventTypeRow>(
        "SELECT event_type, COUNT(*) AS count
         FROM clusters
         GROUP BY event_type
         ORDER BY count DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("event type distribution: {e}")))
}
