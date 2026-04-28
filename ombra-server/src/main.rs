mod db;
mod events;
mod handlers;
mod ingestion;
mod network;
mod onboarding;
mod provision;
mod router;
mod state;
mod tls;

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use axum_server::tls_rustls::RustlsConfig;
use tokio::sync::{broadcast, mpsc};
use tracing::info;
use rustls;

use events::ServerEvent;

use ombra_ai::{
    embeddings::FastEmbedEngine,
    model_loader::load_inference_engine,
    vector_store::QdrantVectorStore,
};
use ombra_common::config::AppConfig;

use ingestion::{cluster_processor::ClusterProcessor, IngestionPipeline};
use state::AppState;

const CONFIG_PATH: &str = "ombra.toml";
const CLUSTER_CHANNEL_BUFFER: usize = 64;

#[tokio::main]
async fn main() {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install rustls crypto provider");

    tracing_subscriber::fmt()
        .json()
        .init();

    let config = AppConfig::load(CONFIG_PATH.as_ref()).unwrap_or_else(|_| {
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
        QdrantVectorStore::connect(&config.qdrant_url, "clusters")
            .await
            .expect("failed to connect to Qdrant"),
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

    let ingestion_pipeline = Arc::new(IngestionPipeline::new(
        database_pool.clone(),
        config.cluster_timeout_minutes,
        cluster_sender,
        encryption_key,
    ));

    let app_state = AppState {
        database_pool,
        ingestion_pipeline,
        inference_engine,
        embedding_engine,
        vector_store,
        config: Arc::new(RwLock::new(config.clone())),
        config_path: PathBuf::from(CONFIG_PATH),
        user_profile_summary: Arc::new(RwLock::new(user_profile_summary)),
        event_broadcast,
    };

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

    let mtls_config = tls::build_mtls_server_config(&config)
        .expect("failed to build mTLS config — run scripts/generate_dev_certs.sh first");

    let rustls_config = RustlsConfig::from_config(mtls_config);
    let address = SocketAddr::from(([0, 0, 0, 0], config.server_port));

    info!(component = "ombra-server", %address, "starting with mTLS");

    axum_server::bind_rustls(address, rustls_config)
        .serve(router::build(app_state).into_make_service())
        .await
        .expect("server failed");
}
