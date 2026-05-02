use std::path::PathBuf;
use std::time::Duration;

use axum::{
    extract::Request,
    middleware,
    routing::{get, patch, post},
    Router,
};
use axum::http::Response;
use tower_http::services::ServeDir;
use tower_http::trace::TraceLayer;
use tracing::Span;
use uuid::Uuid;

use crate::handlers::{analytics, cert_status, clusters, connection_status, danger, devices, entities, hardware, health, le_renew, logs, profile, provision, query, sessions, settings, trash, websocket};
use crate::middleware::lan_only;
use crate::state::AppState;

pub fn build(state: AppState, admin_dir: PathBuf) -> Router {
    let admin_router = Router::new()
        .route("/devices", get(devices::list))
        .route("/devices/:cn/revoke", post(devices::revoke))
        .route("/devices/:cn", axum::routing::delete(devices::delete))
        .route("/logs", get(logs::list))
        .route("/logs/stream", get(logs::stream))
        .route("/hardware", get(hardware::get))
        .route("/hardware/stream", get(hardware::stream))
        .route("/cert-status", get(cert_status::get_status))
        .route("/renew-server-cert", post(provision::renew_server_cert))
        .route("/connection-status", get(connection_status::get_status))
        .route("/le/renew", post(le_renew::force_renew))
        .route("/purge", post(danger::purge))
        .route("/factory-reset", post(danger::factory_reset))
        .route("/analytics/overview", get(analytics::overview))
        .route("/analytics/activity", get(analytics::activity))
        .route("/analytics/entities", get(analytics::entities))
        .route("/analytics/languages", get(analytics::languages))
        .route("/analytics/event-types", get(analytics::event_types))
        .fallback_service(ServeDir::new(admin_dir))
        .layer(middleware::from_fn_with_state(state.clone(), lan_only::require_lan));

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
        .route("/entities/graph", get(entities::graph))
        .route("/entities/:id", get(entities::get))
        .route("/profile", get(profile::get))
        .route("/profile", patch(profile::update))
        .route("/profile/regenerate", post(profile::regenerate))
        .route("/provision/rotate", post(provision::rotate))
        .route("/clusters/trash", get(trash::list))
        .route("/clusters/trash", axum::routing::delete(trash::empty))
        .route("/clusters/:id/flag", post(trash::flag))
        .route("/clusters/:id/restore", post(trash::restore))
        .route("/clusters/:id", axum::routing::delete(trash::delete))
        .route("/settings", get(settings::get))
        .route("/settings", patch(settings::update))
        .nest("/admin", admin_router)
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
