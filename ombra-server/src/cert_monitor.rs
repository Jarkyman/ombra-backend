use std::io::BufReader;
use std::path::Path;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use axum_server::tls_rustls::RustlsConfig;
use reqwest::Client;

use ombra_common::config::{AppConfig, RemoteAccessMode};

pub fn days_until_expiry(path: &Path) -> Option<i64> {
    let pem = std::fs::read_to_string(path).ok()?;
    let der = rustls_pemfile::certs(&mut BufReader::new(pem.as_bytes()))
        .next()?
        .ok()?;
    let (_, cert) = x509_parser::parse_x509_certificate(&der).ok()?;
    let not_after = cert.validity().not_after.timestamp();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;
    Some((not_after - now) / 86400)
}

pub async fn run(config: Arc<RwLock<AppConfig>>) {
    check_once(&config);
    loop {
        tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;
        check_once(&config);
    }
}

fn check_once(config: &Arc<RwLock<AppConfig>>) {
    let config = config.read().unwrap();
    let certs = [
        ("server cert", config.tls_server_cert_path.as_path()),
        ("client CA cert", config.tls_client_ca_cert_path.as_path()),
        ("client cert", config.tls_client_cert_path.as_path()),
    ];
    for (name, path) in certs {
        match days_until_expiry(path) {
            None => tracing::warn!(component = "cert-monitor", cert = name, "could not read cert"),
            Some(d) if d < 0 => tracing::error!(component = "cert-monitor", cert = name, days_remaining = d, "certificate has expired"),
            Some(d) if d < 7 => tracing::error!(component = "cert-monitor", cert = name, days_remaining = d, "certificate expires very soon"),
            Some(d) if d < 30 => tracing::warn!(component = "cert-monitor", cert = name, days_remaining = d, "certificate expiring soon"),
            Some(_) => {}
        }
    }
}

pub async fn run_le_renewal_loop(
    config: Arc<RwLock<AppConfig>>,
    tls_config: RustlsConfig,
    client: Client,
) {
    loop {
        tokio::time::sleep(Duration::from_secs(24 * 60 * 60)).await;

        let mode = config.read().unwrap().remote_access_mode.clone();
        if !matches!(mode, RemoteAccessMode::DuckDns) {
            continue;
        }

        let le_cert_path = config.read().unwrap().le_server_cert_path.clone();
        let needs_renewal = match days_until_expiry(&le_cert_path) {
            Some(days) if days >= 30 => false,
            Some(days) => {
                tracing::warn!(component = "cert-monitor", days_remaining = days, "LE cert expiring — renewing");
                true
            }
            None => {
                tracing::warn!(component = "cert-monitor", "could not read LE cert — attempting renewal");
                true
            }
        };

        if !needs_renewal {
            continue;
        }

        let config_snapshot = config.read().unwrap().clone();
        match crate::network::acme::issue_le_cert(&config_snapshot, &client).await {
            Ok(()) => {
                {
                    let mut c = config.write().unwrap();
                    c.tls_server_cert_path = c.le_server_cert_path.clone();
                    c.tls_server_key_path = c.le_server_key_path.clone();
                }
                let config_snapshot = config.read().unwrap().clone();
                match crate::tls::build_mtls_server_config(&config_snapshot) {
                    Ok(new_server_config) => {
                        tls_config.reload_from_config(new_server_config);
                        tracing::info!(component = "cert-monitor", "LE cert renewed — TLS hot-reloaded");
                    }
                    Err(e) => {
                        tracing::error!(component = "cert-monitor", %e, "TLS hot-reload failed after LE renewal");
                    }
                }
            }
            Err(e) => {
                tracing::error!(component = "cert-monitor", %e, "LE cert renewal failed — will retry in 24h");
            }
        }
    }
}
