pub mod acme;
mod ddns;
mod upnp;

use reqwest::Client;

use ombra_common::config::AppConfig;

pub async fn prepare_le_cert(config: &mut AppConfig, client: &Client) -> Result<(), String> {
    match acme::ensure_le_cert(config, client).await {
        Ok(()) if config.le_server_cert_path.exists() => {
            config.tls_server_cert_path = config.le_server_cert_path.clone();
            config.tls_server_key_path = config.le_server_key_path.clone();
            Ok(())
        }
        Ok(()) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn start(config: &AppConfig) {
    upnp::attempt_port_mapping(config.server_port).await;

    if let Some(ddns_config) = config.ddns.clone() {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("failed to build HTTP client");

        tokio::spawn(ddns::run_update_loop(ddns_config, client));
    } else {
        tracing::info!(component = "ddns", "no DDNS config — skipping (set [ddns] in ombra.toml to enable)");
    }
}
