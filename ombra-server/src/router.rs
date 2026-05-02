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

use crate::handlers::{analytics, clusters, devices, entities, hardware, health, logs, profile, provision, query, sessions, settings, trash, websocket};
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
        .route("/profile", get(profile::get))
        .route("/profile", patch(profile::update))
        .route("/profile/regenerate", post(profile::regenerate))
        .route("/provision/rotate", post(provision::rotate))
        .route("/admin/devices", get(devices::list))
        .route("/admin/devices/:cn/revoke", post(devices::revoke))
        .route("/admin/devices/:cn", axum::routing::delete(devices::delete))
        .route("/clusters/trash", get(trash::list))
        .route("/clusters/trash", axum::routing::delete(trash::empty))
        .route("/clusters/:id/flag", post(trash::flag))
        .route("/clusters/:id/restore", post(trash::restore))
        .route("/clusters/:id", axum::routing::delete(trash::delete))
        .route("/settings", get(settings::get))
        .route("/settings", patch(settings::update))
        .route("/admin/logs", get(logs::list))
        .route("/admin/hardware", get(hardware::get))
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
