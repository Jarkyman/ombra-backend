mod ddns;
mod upnp;

use reqwest::Client;

use ombra_common::config::AppConfig;

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
