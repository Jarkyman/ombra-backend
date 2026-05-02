use std::convert::Infallible;

use axum::{Json, extract::{Query, State}, response::IntoResponse};
use axum::response::sse::{Event, KeepAlive, Sse};
use serde::Deserialize;
use tokio_stream::{iter as stream_iter, Stream, StreamExt, wrappers::BroadcastStream};

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

pub async fn stream(State(state): State<AppState>) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let rx = state.log_buffer.subscribe();
    let recent = state.log_buffer.recent(100);
    let last_recent_id = recent.last().map(|e| e.id).unwrap_or(0);

    let historical = stream_iter(recent).map(|entry| {
        let json = serde_json::to_string(&entry).unwrap_or_default();
        Ok::<_, Infallible>(Event::default().data(json))
    });

    let live = BroadcastStream::new(rx).filter_map(move |result| {
        result.ok()
            .filter(|entry| entry.id > last_recent_id)
            .and_then(|entry| {
                serde_json::to_string(&entry).ok()
                    .map(|json| Ok::<_, Infallible>(Event::default().data(json)))
            })
    });

    Sse::new(historical.chain(live)).keep_alive(KeepAlive::default())
}
