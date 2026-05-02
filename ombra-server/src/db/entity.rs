use std::collections::HashSet;

use sqlx::FromRow;
use uuid::Uuid;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(Debug, FromRow, Clone)]
pub struct Entity {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub encounter_count: i64,
    pub profile_summary: Option<String>,
}

pub async fn upsert_entity(
    pool: &DatabasePool,
    name: &str,
    entity_type: &str,
    timestamp: i64,
) -> Result<Entity, OmbraError> {
    let id = Uuid::new_v4().to_string();

    sqlx::query_as::<_, Entity>(
        "INSERT INTO entities (id, name, entity_type, first_seen, last_seen, encounter_count)
         VALUES (?, ?, ?, ?, ?, 1)
         ON CONFLICT (name) DO UPDATE SET
             encounter_count = encounter_count + 1,
             last_seen       = excluded.last_seen
         RETURNING *",
    )
    .bind(&id)
    .bind(name)
    .bind(entity_type)
    .bind(timestamp)
    .bind(timestamp)
    .fetch_one(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("upsert entity: {e}")))
}

pub async fn link_entity_to_cluster(
    pool: &DatabasePool,
    entity_id: &str,
    cluster_id: &str,
) -> Result<(), OmbraError> {
    sqlx::query(
        "INSERT OR IGNORE INTO entity_mentions (entity_id, cluster_id) VALUES (?, ?)",
    )
    .bind(entity_id)
    .bind(cluster_id)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("link entity to cluster: {e}")))?;

    Ok(())
}

pub async fn update_entity_profile(
    pool: &DatabasePool,
    entity_id: &str,
    profile_summary: &str,
) -> Result<(), OmbraError> {
    sqlx::query("UPDATE entities SET profile_summary = ? WHERE id = ?")
        .bind(profile_summary)
        .bind(entity_id)
        .execute(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("update entity profile: {e}")))?;

    Ok(())
}

pub async fn upsert_entity_relationship(
    pool: &DatabasePool,
    entity_id: &str,
    related_entity_id: &str,
    relationship_type: &str,
) -> Result<(), OmbraError> {
    sqlx::query(
        "INSERT INTO entity_relationships (entity_id, related_entity_id, relationship_type, strength)
         VALUES (?, ?, ?, 0.1)
         ON CONFLICT (entity_id, related_entity_id)
         DO UPDATE SET strength = MIN(strength + 0.1, 1.0)",
    )
    .bind(entity_id)
    .bind(related_entity_id)
    .bind(relationship_type)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("upsert entity relationship: {e}")))?;

    Ok(())
}

pub async fn get_entities_by_ids(
    pool: &DatabasePool,
    ids: &[String],
) -> Result<Vec<Entity>, OmbraError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    let mut qb = sqlx::QueryBuilder::new("SELECT * FROM entities WHERE id IN (");
    let mut sep = qb.separated(", ");
    for id in ids {
        sep.push_bind(id);
    }
    sep.push_unseparated(")");
    qb.build_query_as::<Entity>()
        .fetch_all(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get entities by ids: {e}")))
}

pub async fn list_entities(pool: &DatabasePool) -> Result<Vec<Entity>, OmbraError> {
    sqlx::query_as::<_, Entity>(
        "SELECT * FROM entities ORDER BY encounter_count DESC, last_seen DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list entities: {e}")))
}

pub async fn get_entity_by_id(pool: &DatabasePool, id: &str) -> Result<Option<Entity>, OmbraError> {
    sqlx::query_as::<_, Entity>("SELECT * FROM entities WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get entity: {e}")))
}

pub async fn get_cluster_summaries_for_entity(
    pool: &DatabasePool,
    entity_id: &str,
) -> Result<Vec<String>, OmbraError> {
    sqlx::query_scalar::<_, String>(
        "SELECT c.event_summary FROM clusters c
         JOIN entity_mentions em ON em.cluster_id = c.id
         WHERE em.entity_id = ?
         ORDER BY c.started_at ASC",
    )
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("get cluster summaries for entity: {e}")))
}

#[derive(Debug, FromRow)]
pub struct GraphNodeRow {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub encounter_count: i64,
}

#[derive(Debug, FromRow)]
pub struct GraphEdgeRow {
    pub entity_id: String,
    pub related_entity_id: String,
    pub strength: f64,
}

pub async fn get_entity_graph(
    pool: &DatabasePool,
    max_nodes: i64,
) -> Result<(Vec<GraphNodeRow>, Vec<GraphEdgeRow>), OmbraError> {
    let nodes = sqlx::query_as::<_, GraphNodeRow>(
        "SELECT id, name, entity_type, encounter_count \
         FROM entities ORDER BY encounter_count DESC LIMIT ?",
    )
    .bind(max_nodes)
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("get graph nodes: {e}")))?;

    let node_ids: HashSet<&str> = nodes.iter().map(|n| n.id.as_str()).collect();

    let all_edges = sqlx::query_as::<_, GraphEdgeRow>(
        "SELECT entity_id, related_entity_id, strength FROM entity_relationships",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("get graph edges: {e}")))?;

    let mut seen: HashSet<(String, String)> = HashSet::new();
    let edges = all_edges
        .into_iter()
        .filter(|e| {
            node_ids.contains(e.entity_id.as_str())
                && node_ids.contains(e.related_entity_id.as_str())
        })
        .filter_map(|e| {
            let key = if e.entity_id <= e.related_entity_id {
                (e.entity_id.clone(), e.related_entity_id.clone())
            } else {
                (e.related_entity_id.clone(), e.entity_id.clone())
            };
            if seen.insert(key.clone()) {
                Some(GraphEdgeRow {
                    entity_id: key.0,
                    related_entity_id: key.1,
                    strength: e.strength,
                })
            } else {
                None
            }
        })
        .collect();

    Ok((nodes, edges))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_test_db;

    #[tokio::test]
    async fn first_encounter_creates_entity_with_count_one() {
        let pool = create_test_db().await;
        let entity = upsert_entity(&pool, "Lars", "person", 1000).await.unwrap();

        assert_eq!(entity.name, "Lars");
        assert_eq!(entity.entity_type, "person");
        assert_eq!(entity.encounter_count, 1);

        let first_seen: i64 = sqlx::query_scalar("SELECT first_seen FROM entities WHERE name = 'Lars'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(first_seen, 1000);
    }

    #[tokio::test]
    async fn second_encounter_increments_count() {
        let pool = create_test_db().await;
        upsert_entity(&pool, "Lars", "person", 1000).await.unwrap();
        let entity = upsert_entity(&pool, "Lars", "person", 2000).await.unwrap();

        assert_eq!(entity.encounter_count, 2);

        let (first_seen, last_seen): (i64, i64) = sqlx::query_as(
            "SELECT first_seen, last_seen FROM entities WHERE name = 'Lars'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(first_seen, 1000);
        assert_eq!(last_seen, 2000);
    }

    #[tokio::test]
    async fn different_names_get_separate_entities() {
        let pool = create_test_db().await;
        let lars = upsert_entity(&pool, "Lars", "person", 1000).await.unwrap();
        let mia = upsert_entity(&pool, "Mia", "person", 1000).await.unwrap();

        assert_ne!(lars.id, mia.id);
    }

    #[tokio::test]
    async fn profile_summary_is_stored_and_retrieved() {
        let pool = create_test_db().await;
        let entity = upsert_entity(&pool, "Lars", "person", 1000).await.unwrap();
        update_entity_profile(&pool, &entity.id, "Lars is a colleague.").await.unwrap();

        let updated = upsert_entity(&pool, "Lars", "person", 2000).await.unwrap();
        assert_eq!(updated.profile_summary.as_deref(), Some("Lars is a colleague."));
    }

    #[tokio::test]
    async fn relationship_strength_increases_on_repeat() {
        let pool = create_test_db().await;
        let a = upsert_entity(&pool, "Lars", "person", 1000).await.unwrap();
        let b = upsert_entity(&pool, "Mia", "person", 1000).await.unwrap();

        upsert_entity_relationship(&pool, &a.id, &b.id, "co_occurrence").await.unwrap();
        upsert_entity_relationship(&pool, &a.id, &b.id, "co_occurrence").await.unwrap();

        let strength: f64 = sqlx::query_scalar(
            "SELECT strength FROM entity_relationships WHERE entity_id = ? AND related_entity_id = ?",
        )
        .bind(&a.id)
        .bind(&b.id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!((strength - 0.2).abs() < 0.001);
    }
}
