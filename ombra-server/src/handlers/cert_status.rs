use axum::{Json, extract::State, response::IntoResponse};
use serde::Serialize;

use crate::cert_monitor::days_until_expiry;
use crate::state::AppState;

#[derive(Serialize)]
pub struct CertInfo {
    path: String,
    not_after: i64,
    days_remaining: i64,
    status: &'static str,
}

#[derive(Serialize)]
pub struct CertStatusResponse {
    server_cert: CertInfo,
    client_ca: CertInfo,
    client_cert: CertInfo,
}

fn cert_info(path: &std::path::Path) -> CertInfo {
    let path_str = path.to_string_lossy().into_owned();

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let days_remaining = match days_until_expiry(path) {
        Some(d) => d,
        None => {
            return CertInfo {
                path: path_str,
                not_after: 0,
                days_remaining: -1,
                status: "unreadable",
            }
        }
    };

    let not_after = now + days_remaining * 86400;

    let status = if days_remaining < 0 {
        "expired"
    } else if days_remaining < 7 {
        "critical"
    } else if days_remaining < 30 {
        "expiring_soon"
    } else {
        "ok"
    };

    CertInfo { path: path_str, not_after, days_remaining, status }
}

pub async fn get_status(State(state): State<AppState>) -> impl IntoResponse {
    let (server_cert_path, ca_cert_path, client_cert_path) = {
        let config = state.config.read().unwrap();
        (
            config.tls_server_cert_path.clone(),
            config.tls_client_ca_cert_path.clone(),
            config.tls_client_cert_path.clone(),
        )
    };

    Json(CertStatusResponse {
        server_cert: cert_info(&server_cert_path),
        client_ca: cert_info(&ca_cert_path),
        client_cert: cert_info(&client_cert_path),
    })
}
