use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use tokio::task;

use ombra_common::error::OmbraError;

pub const EMBEDDING_DIMENSIONS: u64 = 768;

#[async_trait]
pub trait EmbeddingEngine: Send + Sync {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, OmbraError>;
}

pub struct FastEmbedEngine {
    model: Arc<Mutex<TextEmbedding>>,
}

impl FastEmbedEngine {
    pub fn load(models_directory: &PathBuf) -> Result<Self, OmbraError> {
        let model = TextEmbedding::try_new(
            TextInitOptions::new(EmbeddingModel::NomicEmbedTextV15)
                .with_cache_dir(models_directory.clone())
                .with_show_download_progress(true),
        )
        .map_err(|e| OmbraError::Inference(format!("load embedding model: {e}")))?;

        Ok(Self {
            model: Arc::new(Mutex::new(model)),
        })
    }
}

#[async_trait]
impl EmbeddingEngine for FastEmbedEngine {
    async fn embed(&self, text: &str) -> Result<Vec<f32>, OmbraError> {
        let model = Arc::clone(&self.model);
        let text = text.to_owned();

        task::spawn_blocking(move || {
            model
                .lock()
                .map_err(|_| OmbraError::Inference("embedding model lock poisoned".to_string()))?
                .embed(vec![text], None)
                .map_err(|e| OmbraError::Inference(format!("embed: {e}")))?
                .into_iter()
                .next()
                .ok_or_else(|| OmbraError::Inference("no embedding returned".to_string()))
        })
        .await
        .map_err(|e| OmbraError::Inference(format!("thread join: {e}")))?
    }
}
