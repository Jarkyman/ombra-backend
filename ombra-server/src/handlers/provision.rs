use std::io::BufReader;
use std::net::UdpSocket;

use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::Serialize;
use sha2::{Digest, Sha256};

use crate::state::AppState;

#[derive(Serialize)]
pub struct RotateResponse {
    pub host: String,
    pub port: u16,
    pub provision_port: u16,
    pub token: String,
    pub ca_fp: String,
}

pub async fn rotate(State(state): State<AppState>) -> impl IntoResponse {
    let token = uuid::Uuid::new_v4().to_string();

    let (ca_cert_path, port, provision_port) = {
        let config = state.config.read().unwrap();
        (
            config.tls_client_ca_cert_path.clone(),
            config.server_port,
            config.provision_port,
        )
    };

    if let Err(error) = write_token(&state.provision_token_path, &token) {
        tracing::error!(%error, "failed to write provision token");
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }

    let ca_fp = match compute_cert_fingerprint(&ca_cert_path) {
        Ok(fp) => fp,
        Err(error) => {
            tracing::error!(%error, "failed to compute CA fingerprint");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };

    let host = detect_lan_ip();

    tracing::info!(component = "provision", "provision token rotated");

    Json(RotateResponse {
        host,
        port,
        provision_port,
        token,
        ca_fp,
    })
    .into_response()
}

fn write_token(path: &std::path::Path, token: &str) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .and_then(|mut f| f.write_all(token.as_bytes()))
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, token)
    }
}

fn compute_cert_fingerprint(
    path: &std::path::Path,
) -> Result<String, Box<dyn std::error::Error>> {
    let pem = std::fs::read_to_string(path)?;
    let mut reader = BufReader::new(pem.as_bytes());

    let cert_der = rustls_pemfile::certs(&mut reader)
        .next()
        .ok_or("no certificate found in CA file")??;

    let hash = Sha256::digest(cert_der.as_ref());
    let fingerprint = hash
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();

    Ok(fingerprint)
}

fn detect_lan_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "ombra.local".to_string())
}
