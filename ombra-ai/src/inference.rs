use async_trait::async_trait;
use ombra_common::error::OmbraError;
use std::path::PathBuf;

#[async_trait]
pub trait InferenceEngine: Send + Sync {
    async fn complete(&self, prompt: &str) -> Result<String, OmbraError>;
}

pub struct InferenceEngineConfig {
    pub model_path: PathBuf,
    pub context_size: u32,
    pub thread_count: u32,
    pub max_tokens: u32,
    pub chat_template: Option<String>,
}
