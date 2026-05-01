use std::time::Duration;

use axum::{
    extract::Request,
    routing::{get, patch, post},
    Router,
};
use axum::http::Response;
use tower_http::trace::TraceLayer;
use tracing::Span;
use uuid::Uuid;

use crate::handlers::{analytics, clusters, entities, health, query, sessions, settings, websocket};
use crate::state::AppState;

pub fn build(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health::check))
        .route("/ws/transcript", get(websocket::handle_transcript_stream))
        .route("/query", post(query::handle))
        .route("/sessions", get(sessions::list))
        .route("/sessions/:session_id/clusters", get(sessions::list_clusters))
        .route("/sessions/:session_id/transcripts", get(sessions::list_transcripts))
        .route("/clusters", get(clusters::list))
        .route("/clusters/:id", get(clusters::get))
        .route("/entities", get(entities::list))
        .route("/entities/:id", get(entities::get))
        .route("/settings", get(settings::get))
        .route("/settings", patch(settings::update))
        .route("/admin/analytics/overview", get(analytics::overview))
        .route("/admin/analytics/activity", get(analytics::activity))
        .route("/admin/analytics/entities", get(analytics::entities))
        .route("/admin/analytics/languages", get(analytics::languages))
        .route("/admin/analytics/event-types", get(analytics::event_types))
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(|request: &Request<_>| {
                    tracing::info_span!(
                        "request",
                        trace_id   = %Uuid::new_v4(),
                        method     = %request.method(),
                        path       = %request.uri().path(),
                        component  = "ombra-server",
                        status     = tracing::field::Empty,
                        latency_ms = tracing::field::Empty,
                    )
                })
                .on_response(|response: &Response<_>, latency: Duration, span: &Span| {
                    span.record("status", response.status().as_u16());
                    span.record("latency_ms", latency.as_millis());
                    tracing::info!(parent: span, "response");
                }),
        )
        .with_state(state)
}
