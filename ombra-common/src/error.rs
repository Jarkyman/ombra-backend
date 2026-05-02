use thiserror::Error;

#[derive(Debug, Error)]
pub enum OmbraError {
    #[error("inference error: {0}")]
    Inference(String),

    #[error("storage error: {0}")]
    Storage(String),

    #[error("network error: {0}")]
    Network(String),
}
