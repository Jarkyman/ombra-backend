use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Serialize;

use crate::db;
use crate::state::AppState;

#[derive(Serialize)]
pub struct EntityResponse {
    pub id: String,
    pub name: String,
    pub entity_type: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub encounter_count: i64,
    pub profile_summary: Option<String>,
}

pub async fn list(State(state): State<AppState>) -> impl IntoResponse {
    match db::entity::list_entities(&state.database_pool).await {
        Ok(entities) => {
            let body: Vec<EntityResponse> = entities.into_iter().map(entity_to_response).collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "list entities failed");
            super::internal_error()
        }
    }
}

pub async fn get(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db::entity::get_entity_by_id(&state.database_pool, &id).await {
        Ok(Some(entity)) => (StatusCode::OK, Json(entity_to_response(entity))).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => {
            tracing::error!(%error, "get entity failed");
            super::internal_error()
        }
    }
}

fn entity_to_response(e: db::entity::Entity) -> EntityResponse {
    EntityResponse {
        id: e.id,
        name: e.name,
        entity_type: e.entity_type,
        first_seen: e.first_seen,
        last_seen: e.last_seen,
        encounter_count: e.encounter_count,
        profile_summary: e.profile_summary,
    }
}

#[derive(Serialize)]
struct GraphNode {
    id: String,
    name: String,
    entity_type: String,
    encounter_count: i64,
}

#[derive(Serialize)]
struct GraphEdge {
    source: String,
    target: String,
    strength: f64,
}

#[derive(Serialize)]
struct GraphResponse {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
}

pub async fn graph(State(state): State<AppState>) -> impl IntoResponse {
    match db::entity::get_entity_graph(&state.database_pool, 200).await {
        Ok((raw_nodes, raw_edges)) => {
            let nodes = raw_nodes
                .into_iter()
                .map(|n| GraphNode {
                    id: n.id,
                    name: n.name,
                    entity_type: n.entity_type,
                    encounter_count: n.encounter_count,
                })
                .collect();

            let edges = raw_edges
                .into_iter()
                .map(|e| GraphEdge {
                    source: e.entity_id,
                    target: e.related_entity_id,
                    strength: e.strength,
                })
                .collect();

            (StatusCode::OK, Json(GraphResponse { nodes, edges })).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "get entity graph failed");
            super::internal_error()
        }
    }
}
