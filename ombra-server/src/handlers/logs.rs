use axum::{Json, extract::{Query, State}, response::IntoResponse};
use serde::Deserialize;

use crate::state::AppState;

#[derive(Deserialize)]
pub struct LogsParams {
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize { 100 }

pub async fn list(
    State(state): State<AppState>,
    Query(params): Query<LogsParams>,
) -> impl IntoResponse {
    let limit = params.limit.min(500);
    Json(state.log_buffer.recent(limit)).into_response()
}
