use std::num::NonZeroUsize;

use ombra_common::{config::AppConfig, error::OmbraError, hardware::HardwareProfile};

use crate::inference::InferenceEngineConfig;
use crate::llama_engine::LlamaCppInferenceEngine;

pub fn load_inference_engine(config: &AppConfig) -> Result<LlamaCppInferenceEngine, OmbraError> {
    let model_path = config.model_path();

    if !model_path.exists() {
        return Err(OmbraError::Inference(format!(
            "model not found at '{}' — run 'ombra install' to download {} for your hardware",
            model_path.display(),
            config.hardware_profile.display_name(),
        )));
    }

    LlamaCppInferenceEngine::load(&build_engine_config(config))
}

fn build_engine_config(config: &AppConfig) -> InferenceEngineConfig {
    let (context_size, max_tokens) = match config.hardware_profile {
        HardwareProfile::Performance => (8192, 2048),
        HardwareProfile::Efficiency => (4096, 1024),
        HardwareProfile::Edge => (2048, 512),
    };

    InferenceEngineConfig {
        model_path: config.model_path(),
        context_size,
        thread_count: detect_optimal_thread_count(),
        max_tokens,
    }
}

fn detect_optimal_thread_count() -> u32 {
    std::thread::available_parallelism()
        .unwrap_or(NonZeroUsize::new(4).unwrap())
        .get() as u32
}
