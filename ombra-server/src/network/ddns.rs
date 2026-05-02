use std::time::Duration;

use reqwest::Client;

use ombra_common::config::DdnsConfig;

const UPDATE_INTERVAL: Duration = Duration::from_secs(300);
const DUCKDNS_UPDATE_URL: &str = "https://www.duckdns.org/update";

pub async fn run_update_loop(config: DdnsConfig, client: Client) {
    let hostname = config.public_hostname();
    tracing::info!(component = "ddns", %hostname, "DDNS update loop started");

    loop {
        if let Err(e) = update(&config, &client).await {
            tracing::warn!(component = "ddns", %e, "DDNS update failed");
        }
        tokio::time::sleep(UPDATE_INTERVAL).await;
    }
}

async fn update(config: &DdnsConfig, client: &Client) -> Result<(), String> {
    use ombra_common::config::DdnsProvider;

    match config.provider {
        DdnsProvider::DuckDns => update_duckdns(config, client).await,
        DdnsProvider::OmbraDns => {
            tracing::debug!(component = "ddns", "OmbraDns provider not yet implemented");
            Ok(())
        }
    }
}

async fn update_duckdns(config: &DdnsConfig, client: &Client) -> Result<(), String> {
    let response = client
        .get(DUCKDNS_UPDATE_URL)
        .query(&[
            ("domains", config.subdomain.as_str()),
            ("token", config.token.as_str()),
            ("ip", ""),
        ])
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let body = response
        .text()
        .await
        .map_err(|e| format!("read response failed: {e}"))?;

    if body.trim_start().starts_with("OK") {
        tracing::info!(component = "ddns", hostname = %config.public_hostname(), "DDNS record updated");
        Ok(())
    } else {
        Err(format!("DuckDNS returned: {body}"))
    }
}
