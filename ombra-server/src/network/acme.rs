use std::path::Path;
use std::time::Duration;

use reqwest::Client;
use tracing::{info, warn};

use ombra_common::config::{AppConfig, DdnsConfig, RemoteAccessMode};

const PROPAGATION_WAIT_SECS: u64 = 60;
const POLL_INTERVAL_SECS: u64 = 5;
const MAX_POLL_ATTEMPTS: u32 = 60;

pub async fn ensure_le_cert(config: &AppConfig, client: &Client) -> Result<(), String> {
    if !matches!(config.remote_access_mode, RemoteAccessMode::DuckDns) {
        return Ok(());
    }

    let ddns = config
        .ddns
        .as_ref()
        .ok_or_else(|| "DuckDNS mode active but no [ddns] config in ombra.toml".to_string())?;

    if config.le_server_cert_path.exists() {
        match crate::cert_monitor::days_until_expiry(&config.le_server_cert_path) {
            Some(days) if days >= 30 => {
                info!(
                    component = "acme",
                    domain = %ddns.public_hostname(),
                    days_remaining = days,
                    "LE cert valid — skipping issuance"
                );
                return Ok(());
            }
            Some(days) => warn!(component = "acme", days_remaining = days, "LE cert expiring soon — renewing"),
            None => warn!(component = "acme", "could not read LE cert — re-issuing"),
        }
    }

    run_issuance(ddns, config, client).await
}

pub async fn issue_le_cert(config: &AppConfig, client: &Client) -> Result<(), String> {
    let ddns = config
        .ddns
        .as_ref()
        .ok_or_else(|| "no [ddns] config in ombra.toml".to_string())?;
    run_issuance(ddns, config, client).await
}

async fn run_issuance(ddns: &DdnsConfig, config: &AppConfig, client: &Client) -> Result<(), String> {
    use instant_acme::{ChallengeType, Identifier, NewOrder, OrderStatus};

    let domain = ddns.public_hostname();
    info!(component = "acme", %domain, "starting ACME DNS-01 certificate issuance");

    let account = load_or_create_account(&config.le_account_key_path).await?;

    let mut order = account
        .new_order(&NewOrder {
            identifiers: &[Identifier::Dns(domain.clone())],
        })
        .await
        .map_err(|e| format!("ACME new order: {e}"))?;

    let authorizations = order
        .authorizations()
        .await
        .map_err(|e| format!("ACME authorizations: {e}"))?;

    for auth in &authorizations {
        let challenge = auth
            .challenges
            .iter()
            .find(|c| c.r#type == ChallengeType::Dns01)
            .ok_or_else(|| "no DNS-01 challenge found in authorization".to_string())?;

        let key_auth = order.key_authorization(challenge);
        let dns_value = key_auth.dns_value();

        info!(component = "acme", %domain, "setting DuckDNS TXT record for DNS-01 challenge");
        set_duckdns_txt(ddns, &dns_value, client).await?;

        info!(component = "acme", secs = PROPAGATION_WAIT_SECS, "waiting for DNS propagation");
        tokio::time::sleep(Duration::from_secs(PROPAGATION_WAIT_SECS)).await;

        order
            .set_challenge_ready(&challenge.url)
            .await
            .map_err(|e| format!("ACME set challenge ready: {e}"))?;
    }

    info!(component = "acme", "polling for ACME challenge validation");
    let mut validated = false;
    for _ in 0..MAX_POLL_ATTEMPTS {
        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;

        let state = order
            .refresh()
            .await
            .map_err(|e| format!("ACME poll: {e}"))?;

        match state.status {
            OrderStatus::Ready => {
                validated = true;
                break;
            }
            OrderStatus::Invalid => {
                clear_duckdns_txt(ddns, client).await;
                return Err(format!("ACME order invalid after challenge: {:?}", state.error));
            }
            _ => {}
        }
    }

    if !validated {
        clear_duckdns_txt(ddns, client).await;
        return Err("ACME challenge validation timed out".to_string());
    }

    let mut params = rcgen::CertificateParams::new(vec![domain.clone()]);
    params.alg = &rcgen::PKCS_ECDSA_P256_SHA256;
    let cert = rcgen::Certificate::from_params(params)
        .map_err(|e| format!("generate key pair for CSR: {e}"))?;
    let csr_der = cert
        .serialize_request_der()
        .map_err(|e| format!("serialize CSR: {e}"))?;
    let private_key_pem = cert.serialize_private_key_pem();

    order
        .finalize(&csr_der)
        .await
        .map_err(|e| format!("ACME finalize: {e}"))?;

    info!(component = "acme", "waiting for certificate to be issued");
    let cert_chain_pem = loop {
        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;

        let state = order
            .refresh()
            .await
            .map_err(|e| format!("ACME poll after finalize: {e}"))?;

        if state.status == OrderStatus::Invalid {
            clear_duckdns_txt(ddns, client).await;
            return Err("ACME order became invalid after finalize".to_string());
        }

        match order.certificate().await {
            Ok(Some(cert)) => break cert,
            Ok(None) => continue,
            Err(e) => {
                clear_duckdns_txt(ddns, client).await;
                return Err(format!("ACME get certificate: {e}"));
            }
        }
    };

    if let Some(parent) = config.le_server_cert_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    write_private_string(&config.le_server_cert_path, &cert_chain_pem)?;
    write_private_string(&config.le_server_key_path, &private_key_pem)?;

    clear_duckdns_txt(ddns, client).await;

    info!(component = "acme", %domain, "LE certificate issued and saved successfully");
    Ok(())
}

async fn load_or_create_account(key_path: &Path) -> Result<instant_acme::Account, String> {
    if key_path.exists() {
        let json = std::fs::read_to_string(key_path)
            .map_err(|e| format!("read ACME account credentials: {e}"))?;
        let creds: instant_acme::AccountCredentials = serde_json::from_str(&json)
            .map_err(|e| format!("parse ACME account credentials: {e}"))?;
        instant_acme::Account::from_credentials(creds)
            .await
            .map_err(|e| format!("load ACME account: {e}"))
    } else {
        let (account, creds) = instant_acme::Account::create(
            &instant_acme::NewAccount {
                contact: &[],
                terms_of_service_agreed: true,
                only_return_existing: false,
            },
            instant_acme::LetsEncrypt::Production.url(),
            None,
        )
        .await
        .map_err(|e| format!("create ACME account: {e}"))?;

        let json = serde_json::to_string(&creds)
            .map_err(|e| format!("serialize ACME account credentials: {e}"))?;

        if let Some(parent) = key_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        write_private_string(key_path, &json)?;

        info!(component = "acme", "new ACME account created");
        Ok(account)
    }
}

async fn set_duckdns_txt(ddns: &DdnsConfig, value: &str, client: &Client) -> Result<(), String> {
    let response = client
        .get("https://www.duckdns.org/update")
        .query(&[
            ("domains", ddns.subdomain.as_str()),
            ("token", ddns.token.as_str()),
            ("txt", value),
        ])
        .send()
        .await
        .map_err(|e| format!("DuckDNS TXT update request: {e}"))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("DuckDNS TXT update response body: {e}"))?;

    if body.trim_start().starts_with("OK") {
        Ok(())
    } else {
        Err(format!("DuckDNS TXT update returned unexpected response: {body}"))
    }
}

async fn clear_duckdns_txt(ddns: &DdnsConfig, client: &Client) {
    let _ = client
        .get("https://www.duckdns.org/update")
        .query(&[
            ("domains", ddns.subdomain.as_str()),
            ("token", ddns.token.as_str()),
            ("txt", ""),
            ("clear", "true"),
        ])
        .send()
        .await;
    info!(component = "acme", "DuckDNS TXT record cleared");
}

fn write_private_string(path: &Path, content: &str) -> Result<(), String> {
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
            .and_then(|mut f| f.write_all(content.as_bytes()))
            .map_err(|e| format!("write {}: {e}", path.display()))
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, content).map_err(|e| format!("write {}: {e}", path.display()))
    }
}
