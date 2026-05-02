use axum::{extract::State, http::StatusCode, response::IntoResponse};

use crate::{db, state::AppState};

pub async fn purge(State(state): State<AppState>) -> impl IntoResponse {
    if let Err(e) = db::reset::purge_memories(&state.database_pool).await {
        tracing::error!(error = %e, "purge failed");
        return super::internal_error();
    }
    if let Err(e) = state.vector_store.clear_collections().await {
        tracing::error!(error = %e, "purge qdrant collections failed");
        return super::internal_error();
    }
    StatusCode::NO_CONTENT.into_response()
}

pub async fn factory_reset(State(state): State<AppState>) -> impl IntoResponse {
    if let Err(e) = db::reset::factory_reset(&state.database_pool).await {
        tracing::error!(error = %e, "factory reset failed");
        return super::internal_error();
    }
    if let Err(e) = state.vector_store.clear_collections().await {
        tracing::error!(error = %e, "factory reset qdrant failed");
        return super::internal_error();
    }
    *state.user_profile_summary.write().unwrap() = None;
    StatusCode::NO_CONTENT.into_response()
}
