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

pub async fn renew_server_cert(State(state): State<AppState>) -> impl IntoResponse {
    let (server_cert, server_key, ca_cert, ca_key) = {
        let config = state.config.read().unwrap();
        (
            config.tls_server_cert_path.to_string_lossy().into_owned(),
            config.tls_server_key_path.to_string_lossy().into_owned(),
            config.tls_client_ca_cert_path.to_string_lossy().into_owned(),
            config.tls_ca_key_path.to_string_lossy().into_owned(),
        )
    };

    if !std::path::Path::new(&ca_key).exists() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({
                "error": "ERR_NO_CA_KEY",
                "message": "CA private key not found. Ensure certs/ca.key exists (dev setup only)."
            })),
        )
            .into_response();
    }

    let lan_ip = detect_lan_ip();

    match tokio::task::spawn_blocking(move || {
        run_openssl_renew(&server_cert, &server_key, &ca_cert, &ca_key, &lan_ip)
    })
    .await
    {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            tracing::error!(error = %e, component = "provision", "server cert renewal failed");
            return super::internal_error();
        }
        Err(e) => {
            tracing::error!(error = %e, component = "provision", "cert renewal task panicked");
            return super::internal_error();
        }
    }

    let config_snapshot = state.config.read().unwrap().clone();
    match crate::tls::build_mtls_server_config(&config_snapshot) {
        Ok(new_server_config) => {
            state.tls_config.reload_from_config(new_server_config);
            tracing::info!(component = "provision", "server certificate renewed — TLS hot-reloaded");
            StatusCode::NO_CONTENT.into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, component = "provision", "cert renewed but TLS hot-reload failed");
            super::internal_error()
        }
    }
}

fn run_openssl_renew(
    server_cert: &str,
    server_key: &str,
    ca_cert: &str,
    ca_key: &str,
    lan_ip: &str,
) -> Result<(), String> {
    let uid = uuid::Uuid::new_v4().simple().to_string();
    let tmp = std::env::temp_dir();
    let csr = tmp.join(format!("ombra_{uid}.csr"));
    let ext = tmp.join(format!("ombra_{uid}.ext"));

    struct TmpGuard(Vec<std::path::PathBuf>);
    impl Drop for TmpGuard {
        fn drop(&mut self) {
            for p in &self.0 {
                let _ = std::fs::remove_file(p);
            }
        }
    }
    let _guard = TmpGuard(vec![csr.clone(), ext.clone()]);

    let csr_str = csr.to_string_lossy().into_owned();
    let ext_str = ext.to_string_lossy().into_owned();

    run_openssl(&["genrsa", "-out", server_key, "2048"])?;
    run_openssl(&[
        "req", "-new",
        "-key", server_key,
        "-out", &csr_str,
        "-subj", "/CN=ombra-server/O=Ombra",
    ])?;

    let mut san = "DNS:localhost,DNS:ombra.local,IP:127.0.0.1".to_string();
    if !lan_ip.is_empty() && lan_ip != "127.0.0.1" && lan_ip != "ombra.local" {
        san.push_str(&format!(",IP:{lan_ip}"));
    }
    let ext_content =
        format!("subjectAltName={san}\nextendedKeyUsage=serverAuth\nbasicConstraints=CA:FALSE\n");
    std::fs::write(&ext, &ext_content).map_err(|e| format!("write ext file: {e}"))?;

    run_openssl(&[
        "x509", "-req", "-days", "365",
        "-in", &csr_str,
        "-CA", ca_cert,
        "-CAkey", ca_key,
        "-CAcreateserial",
        "-extfile", &ext_str,
        "-out", server_cert,
    ])?;

    Ok(())
}

fn run_openssl(args: &[&str]) -> Result<(), String> {
    let out = std::process::Command::new("openssl")
        .args(args)
        .output()
        .map_err(|e| format!("spawn openssl: {e}"))?;
    if !out.status.success() {
        return Err(format!(
            "openssl {}: {}",
            args[0],
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(())
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

pub fn detect_lan_ip() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("8.8.8.8:80")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "ombra.local".to_string())
}
