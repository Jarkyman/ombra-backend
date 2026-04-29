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
pub struct SessionResponse {
    pub session_id: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub transcript_count: i64,
    pub cluster_count: i64,
}

#[derive(Serialize)]
pub struct ClusterResponse {
    pub id: String,
    pub started_at: i64,
    pub closed_at: i64,
    pub event_type: String,
    pub relevance_score: f32,
    pub event_summary: String,
    pub language: String,
}

pub async fn list(State(state): State<AppState>) -> impl IntoResponse {
    match db::session::list_sessions(&state.database_pool).await {
        Ok(sessions) => {
            let body: Vec<SessionResponse> = sessions
                .into_iter()
                .map(|s| SessionResponse {
                    session_id: s.session_id,
                    first_seen: s.first_seen,
                    last_seen: s.last_seen,
                    transcript_count: s.transcript_count,
                    cluster_count: s.cluster_count,
                })
                .collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "list sessions failed");
            super::internal_error()
        }
    }
}

pub async fn list_clusters(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    match db::cluster::list_clusters_by_session(&state.database_pool, &session_id).await {
        Ok(clusters) => {
            let body: Vec<ClusterResponse> = clusters
                .into_iter()
                .map(cluster_to_response)
                .collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "list session clusters failed");
            super::internal_error()
        }
    }
}

#[derive(Serialize)]
pub struct TranscriptResponse {
    pub id: String,
    pub session_id: String,
    pub content: String,
    pub detected_language: String,
    pub recorded_at: i64,
}

pub async fn list_transcripts(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let encryption_key = {
        let config = state.config.read().unwrap();
        match config.encryption_key_bytes() {
            Ok(k) => k,
            Err(error) => {
                tracing::error!(%error, "invalid encryption key");
                return super::internal_error();
            }
        }
    };

    match db::transcript::list_transcripts_by_session(&state.database_pool, &session_id, &encryption_key).await {
        Ok(transcripts) => {
            let body: Vec<TranscriptResponse> = transcripts
                .into_iter()
                .map(|t| TranscriptResponse {
                    id: t.id,
                    session_id: t.session_id,
                    content: t.content,
                    detected_language: t.detected_language,
                    recorded_at: t.recorded_at,
                })
                .collect();
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "list session transcripts failed");
            super::internal_error()
        }
    }
}

fn cluster_to_response(c: db::cluster::Cluster) -> ClusterResponse {
    ClusterResponse {
        id: c.id,
        started_at: c.started_at,
        closed_at: c.closed_at,
        event_type: c.event_type,
        relevance_score: c.relevance_score,
        event_summary: c.event_summary,
        language: c.language,
    }
}
