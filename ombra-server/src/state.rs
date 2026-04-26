use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use tokio::sync::broadcast;
use ombra_ai::{
    embeddings::EmbeddingEngine,
    inference::InferenceEngine,
    vector_store::QdrantVectorStore,
};
use ombra_common::config::AppConfig;

use crate::db::DatabasePool;
use crate::events::ServerEvent;
use crate::ingestion::IngestionPipeline;

#[derive(Clone)]
pub struct AppState {
    pub database_pool: DatabasePool,
    pub ingestion_pipeline: Arc<IngestionPipeline>,
    pub inference_engine: Arc<dyn InferenceEngine>,
    pub embedding_engine: Arc<dyn EmbeddingEngine>,
    pub vector_store: Arc<QdrantVectorStore>,
    pub config: Arc<RwLock<AppConfig>>,
    pub config_path: PathBuf,
    pub user_profile_summary: Arc<RwLock<Option<String>>>,
    pub event_broadcast: broadcast::Sender<ServerEvent>,
}
