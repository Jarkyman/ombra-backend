mod cert_monitor;
mod db;
mod events;
mod handlers;
mod ingestion;
mod log_buffer;
mod middleware;
mod network;
mod onboarding;
mod provision;
mod router;
mod state;
mod tls;

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use axum_server::tls_rustls::RustlsConfig;
use tokio::sync::{broadcast, mpsc};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use log_buffer::{LogBuffer, LogBufferLayer};

use events::ServerEvent;

use ombra_ai::{
    embeddings::FastEmbedEngine,
    model_loader::load_inference_engine,
    vector_store::QdrantVectorStore,
};
use ombra_common::config::AppConfig;

use ingestion::{cluster::OpenCluster, cluster_processor::ClusterProcessor, IngestionPipeline};
use state::AppState;

const CONFIG_PATH: &str = "ombra.toml";
const CLUSTER_CHANNEL_BUFFER: usize = 64;

#[tokio::main]
async fn main() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install rustls crypto provider");

    let log_buffer = LogBuffer::new();

    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer().json())
        .with(LogBufferLayer::new(log_buffer.clone()))
        .init();

    let mut config = AppConfig::load(CONFIG_PATH.as_ref()).unwrap_or_else(|_| {
        let default = AppConfig::default();
        default
            .save(CONFIG_PATH.as_ref())
            .expect("failed to write default config");
        default
    });

    let encryption_key = config
        .encryption_key_bytes()
        .expect("invalid encryption key in config");

    let database_pool = db::create_pool(
        config
            .database_path
            .to_str()
            .expect("invalid database path"),
    )
    .await
    .expect("failed to connect to database");

    db::run_migrations(&database_pool)
        .await
        .expect("failed to run migrations");

    let inference_engine: Arc<dyn ombra_ai::inference::InferenceEngine> = Arc::new(
        load_inference_engine(&config).expect("failed to load inference engine"),
    );

    let user_profile_summary = onboarding::run_if_needed(&database_pool, &inference_engine).await;

    let embedding_engine: Arc<dyn ombra_ai::embeddings::EmbeddingEngine> = Arc::new(
        FastEmbedEngine::load(&config.models_directory).expect("failed to load embedding engine"),
    );

    let vector_store = Arc::new(
        connect_qdrant_with_retry(&config.qdrant_url, "clusters", 8, Duration::from_secs(3))
            .await
            .expect("failed to connect to Qdrant after retries"),
    );

    let (cluster_sender, cluster_receiver) = mpsc::channel(CLUSTER_CHANNEL_BUFFER);
    let (event_broadcast, _) = broadcast::channel::<ServerEvent>(128);

    let cluster_processor = ClusterProcessor::new(
        database_pool.clone(),
        Arc::clone(&inference_engine),
        Arc::clone(&embedding_engine),
        Arc::clone(&vector_store),
        encryption_key,
        config.profile_encounter_threshold,
        event_broadcast.clone(),
    );

    cluster_processor.spawn(cluster_receiver);

    sweep_stale_clusters(&database_pool, &cluster_sender).await;

    let ingestion_pipeline = Arc::new(IngestionPipeline::new(
        database_pool.clone(),
        config.cluster_timeout_minutes,
        cluster_sender,
        encryption_key,
    ));

    let acme_client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .build()
        .expect("failed to build ACME HTTP client");

    if matches!(config.remote_access_mode, ombra_common::config::RemoteAccessMode::DuckDns) {
        match network::prepare_le_cert(&mut config, &acme_client).await {
            Ok(()) => info!(component = "acme", "LE certificate ready"),
            Err(e) => tracing::warn!(component = "acme", %e, "LE cert preparation failed — using self-signed cert"),
        }
    }

    let mtls_config = tls::build_mtls_server_config(&config)
        .expect("failed to build mTLS config — run scripts/generate_dev_certs.sh first");
    let rustls_config = RustlsConfig::from_config(mtls_config);

    let app_state = AppState {
        database_pool,
        ingestion_pipeline,
        inference_engine,
        embedding_engine,
        vector_store,
        config: Arc::new(RwLock::new(config.clone())),
        config_path: PathBuf::from(CONFIG_PATH),
        provision_token_path: PathBuf::from("provision_token"),
        user_profile_summary: Arc::new(RwLock::new(user_profile_summary)),
        event_broadcast,
        log_buffer,
        tls_config: rustls_config.clone(),
    };

    info!(
        component = "network",
        mode = ?config.remote_access_mode,
        "remote access mode"
    );
    network::start(&config).await;

    let provision_state = provision::ProvisionState::new(
        PathBuf::from("provision_token"),
        config.tls_client_ca_cert_path.clone(),
        config.tls_client_cert_path.clone(),
        config.tls_client_key_path.clone(),
    );

    let provision_addr = SocketAddr::from(([0, 0, 0, 0], config.provision_port));
    tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(provision_addr)
            .await
            .expect("failed to bind provision server");
        info!(component = "provision", %provision_addr, "provision server listening");
        axum::serve(
            listener,
            provision::build_router(provision_state).into_make_service(),
        )
        .await
        .expect("provision server failed");
    });

    tokio::spawn(cert_monitor::run(Arc::clone(&app_state.config)));
    tokio::spawn(cert_monitor::run_le_renewal_loop(
        Arc::clone(&app_state.config),
        rustls_config.clone(),
        acme_client,
    ));
    let address = SocketAddr::from(([0, 0, 0, 0], config.server_port));

    info!(component = "ombra-server", %address, "starting with mTLS");

    register_client_cert(&app_state.database_pool, &config).await;

    let admin_dir = config.admin_dir.clone();

    axum_server::bind_rustls(address, rustls_config)
        .serve(router::build(app_state, admin_dir).into_make_service_with_connect_info::<SocketAddr>())
        .await
        .expect("server failed");
}

async fn register_client_cert(pool: &db::DatabasePool, config: &AppConfig) {
    let cert_bytes = match std::fs::read(&config.tls_client_cert_path) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(%e, "could not read client cert for device registration");
            return;
        }
    };

    let mut reader = std::io::BufReader::new(cert_bytes.as_slice());
    let der = match rustls_pemfile::certs(&mut reader).next() {
        Some(Ok(d)) => d,
        _ => {
            tracing::warn!("no cert found in client cert file");
            return;
        }
    };

    let cn = match x509_parser::parse_x509_certificate(der.as_ref()) {
        Ok((_, cert)) => cert
            .subject()
            .iter_common_name()
            .next()
            .and_then(|a| a.as_str().ok())
            .unwrap_or("unknown")
            .to_string(),
        Err(e) => {
            tracing::warn!(%e, "could not parse client cert for device registration");
            return;
        }
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    if let Err(e) = db::device::upsert_device(pool, &cn, &cn, now).await {
        tracing::warn!(%e, "could not register client cert as trusted device");
    } else {
        tracing::info!(component = "devices", %cn, "client cert registered as trusted device");
    }
}

async fn connect_qdrant_with_retry(
    url: &str,
    collection: &str,
    attempts: u32,
    delay: Duration,
) -> Result<QdrantVectorStore, ombra_common::error::OmbraError> {
    let mut last_error = None;
    for attempt in 1..=attempts {
        match QdrantVectorStore::connect(url, collection).await {
            Ok(store) => return Ok(store),
            Err(error) => {
                tracing::warn!(attempt, %error, delay_secs = delay.as_secs(), "Qdrant not ready — retrying");
                last_error = Some(error);
                if attempt < attempts {
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }
    Err(last_error.unwrap())
}

async fn sweep_stale_clusters(pool: &db::DatabasePool, cluster_sender: &mpsc::Sender<OpenCluster>) {
    let stubs = match db::transcript::get_unassigned_transcript_stubs(pool).await {
        Ok(s) => s,
        Err(error) => {
            tracing::warn!(%error, "stale cluster sweep failed — skipping");
            return;
        }
    };

    if stubs.is_empty() {
        return;
    }

    let mut by_session: HashMap<String, Vec<(String, i64)>> = HashMap::new();
    for stub in stubs {
        by_session
            .entry(stub.session_id)
            .or_default()
            .push((stub.id, stub.recorded_at));
    }

    let session_count = by_session.len();
    for (session_id, transcripts) in by_session {
        let started_at = transcripts.iter().map(|(_, t)| *t).min().unwrap_or(0);
        let transcript_ids = transcripts.into_iter().map(|(id, _)| id).collect();

        let cluster = OpenCluster {
            cluster_id: Uuid::new_v4().to_string(),
            session_id: session_id.clone(),
            started_at,
            transcript_ids,
            last_activity: std::time::Instant::now(),
        };

        if let Err(error) = cluster_sender.send(cluster).await {
            tracing::error!(session_id = %session_id, %error, "failed to queue stale cluster on startup");
        }
    }

    tracing::info!(session_count, "stale clusters swept and queued for processing");
}
