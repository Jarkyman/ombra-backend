use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::state::AppState;

#[derive(Serialize)]
pub struct TrashedClusterResponse {
    pub id: String,
    pub event_type: String,
    pub event_summary: String,
    pub relevance_score: f32,
    pub started_at: i64,
    pub flagged_at: i64,
    pub flagged_by: String,
}

#[derive(Deserialize)]
pub struct FlagBody {
    pub flagged_by: Option<String>,
}

#[derive(Serialize)]
struct DeletedResponse {
    deleted: i64,
}

pub async fn list(State(state): State<AppState>) -> impl IntoResponse {
    match db::cluster::list_trashed_clusters(&state.database_pool).await {
        Ok(clusters) => {
            let body: Vec<TrashedClusterResponse> = clusters
                .into_iter()
                .map(|c| TrashedClusterResponse {
                    id: c.id,
                    event_type: c.event_type,
                    event_summary: c.event_summary,
                    relevance_score: c.relevance_score,
                    started_at: c.started_at,
                    flagged_at: c.flagged_at,
                    flagged_by: c.flagged_by,
                })
                .collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "list trashed clusters");
            super::internal_error()
        }
    }
}

pub async fn flag(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<FlagBody>,
) -> impl IntoResponse {
    let flagged_by = body.flagged_by.as_deref().unwrap_or("user");
    match db::cluster::flag_cluster(&state.database_pool, &id, flagged_by).await {
        Ok(true)  => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => super::not_found(),
        Err(error) => {
            tracing::error!(%error, "flag cluster");
            super::internal_error()
        }
    }
}

pub async fn restore(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db::cluster::restore_cluster(&state.database_pool, &id).await {
        Ok(true)  => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => super::not_found(),
        Err(error) => {
            tracing::error!(%error, "restore cluster");
            super::internal_error()
        }
    }
}

pub async fn delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match db::cluster::delete_cluster(&state.database_pool, &id).await {
        Ok(true)  => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => super::not_found(),
        Err(error) => {
            tracing::error!(%error, "delete cluster");
            super::internal_error()
        }
    }
}

pub async fn empty(State(state): State<AppState>) -> impl IntoResponse {
    match db::cluster::delete_all_trashed_clusters(&state.database_pool).await {
        Ok(deleted) => (StatusCode::OK, Json(DeletedResponse { deleted })).into_response(),
        Err(error) => {
            tracing::error!(%error, "empty trash");
            super::internal_error()
        }
    }
}
