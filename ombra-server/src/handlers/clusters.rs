use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::state::AppState;

const DEFAULT_LIMIT: i64 = 20;
const MAX_LIMIT: i64 = 100;

#[derive(Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Serialize)]
pub struct ClusterResponse {
    pub id: String,
    pub session_id: String,
    pub started_at: i64,
    pub closed_at: i64,
    pub event_type: String,
    pub relevance_score: f32,
    pub event_summary: String,
    pub language: String,
}

pub async fn list(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> impl IntoResponse {
    let limit = params.limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);
    let offset = params.offset.unwrap_or(0).max(0);

    match db::cluster::list_clusters(&state.database_pool, limit, offset).await {
        Ok(clusters) => {
            let body: Vec<ClusterResponse> = clusters.into_iter().map(into_response).collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "list clusters failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

pub async fn get(
    State(state): State<AppState>,
    Path(cluster_id): Path<String>,
) -> impl IntoResponse {
    match db::cluster::get_cluster_by_id(&state.database_pool, &cluster_id).await {
        Ok(Some(cluster)) => (StatusCode::OK, Json(into_response(cluster))).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(error) => {
            tracing::error!(%error, "get cluster failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

fn into_response(c: db::cluster::Cluster) -> ClusterResponse {
    ClusterResponse {
        id: c.id,
        session_id: c.session_id,
        started_at: c.started_at,
        closed_at: c.closed_at,
        event_type: c.event_type,
        relevance_score: c.relevance_score,
        event_summary: c.event_summary,
        language: c.language,
    }
}
