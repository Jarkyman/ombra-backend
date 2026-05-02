use axum::{Json, extract::State, response::IntoResponse};
use serde::Serialize;
use ombra_common::config::RemoteAccessMode;

use crate::cert_monitor::days_until_expiry;
use crate::handlers::provision::detect_lan_ip;
use crate::state::AppState;

#[derive(Serialize)]
pub struct ConnectionStatusResponse {
    pub mode: RemoteAccessMode,
    pub lan_ip: String,
    pub server_port: u16,
    pub tailscale_ip: Option<String>,
    pub duckdns_hostname: Option<String>,
    pub duckdns_token_set: bool,
    pub le_cert_days_remaining: Option<i64>,
}

pub async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    let (mode, port, ddns, le_cert_path) = {
        let config = state.config.read().unwrap();
        (
            config.remote_access_mode.clone(),
            config.server_port,
            config.ddns.clone(),
            config.le_server_cert_path.clone(),
        )
    };

    let lan_ip = detect_lan_ip();

    let tailscale_ip = if matches!(mode, RemoteAccessMode::Tailscale) {
        detect_tailscale_ip().await
    } else {
        None
    };

    let (duckdns_hostname, duckdns_token_set) = match (&mode, &ddns) {
        (RemoteAccessMode::DuckDns, Some(cfg)) => {
            (Some(cfg.public_hostname()), !cfg.token.is_empty())
        }
        _ => (None, false),
    };

    let le_cert_days_remaining = if matches!(mode, RemoteAccessMode::DuckDns) {
        days_until_expiry(&le_cert_path)
    } else {
        None
    };

    Json(ConnectionStatusResponse {
        mode,
        lan_ip,
        server_port: port,
        tailscale_ip,
        duckdns_hostname,
        duckdns_token_set,
        le_cert_days_remaining,
    })
}

async fn detect_tailscale_ip() -> Option<String> {
    tokio::task::spawn_blocking(|| {
        let output = std::process::Command::new("tailscale")
            .args(["ip", "-4"])
            .output()
            .ok()?;
        if output.status.success() {
            let ip = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if ip.is_empty() { None } else { Some(ip) }
        } else {
            None
        }
    })
    .await
    .ok()?
}
