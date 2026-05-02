use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use ombra_common::config::RemoteAccessMode;

use crate::state::AppState;

pub async fn force_renew(State(state): State<AppState>) -> impl IntoResponse {
    let config_snapshot = state.config.read().unwrap().clone();

    if !matches!(config_snapshot.remote_access_mode, RemoteAccessMode::DuckDns) {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({
                "error": "ERR_NOT_DUCKDNS_MODE",
                "message": "Force renewal is only available in DuckDNS mode."
            })),
        )
            .into_response();
    }

    if config_snapshot.ddns.is_none() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({
                "error": "ERR_NO_DDNS_CONFIG",
                "message": "No [ddns] section in ombra.toml."
            })),
        )
            .into_response();
    }

    let arc_config = Arc::clone(&state.config);
    let tls_config = state.tls_config.clone();

    tokio::spawn(async move {
        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(300))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                tracing::error!(component = "acme", %e, "failed to build HTTP client for force renewal");
                return;
            }
        };

        match crate::network::acme::issue_le_cert(&config_snapshot, &client).await {
            Ok(()) => {
                {
                    let mut c = arc_config.write().unwrap();
                    c.tls_server_cert_path = c.le_server_cert_path.clone();
                    c.tls_server_key_path = c.le_server_key_path.clone();
                }
                let updated = arc_config.read().unwrap().clone();
                match crate::tls::build_mtls_server_config(&updated) {
                    Ok(new_config) => {
                        tls_config.reload_from_config(new_config);
                        tracing::info!(component = "acme", "force renewal complete — TLS hot-reloaded");
                    }
                    Err(e) => {
                        tracing::error!(component = "acme", %e, "TLS hot-reload failed after force renewal");
                    }
                }
            }
            Err(e) => {
                tracing::error!(component = "acme", %e, "force renewal failed");
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(serde_json::json!({"status": "renewing"})),
    )
        .into_response()
}
