use std::sync::Arc;

use async_trait::async_trait;
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel},
    token::LlamaToken,
};
use tokio::task;

use ombra_common::error::OmbraError;

use crate::inference::{InferenceEngine, InferenceEngineConfig};

pub struct LlamaCppInferenceEngine {
    model: Arc<LlamaModel>,
    backend: Arc<LlamaBackend>,
    max_tokens: i32,
}

impl LlamaCppInferenceEngine {
    pub fn load(config: &InferenceEngineConfig) -> Result<Self, OmbraError> {
        let backend = LlamaBackend::init()
            .map_err(|e| OmbraError::Inference(format!("backend init: {e}")))?;

        let model_params = LlamaModelParams::default();

        let model = LlamaModel::load_from_file(&backend, &config.model_path, &model_params)
            .map_err(|e| OmbraError::Inference(format!("model load: {e}")))?;

        Ok(Self {
            model: Arc::new(model),
            backend: Arc::new(backend),
            max_tokens: config.max_tokens as i32,
        })
    }
}

#[async_trait]
impl InferenceEngine for LlamaCppInferenceEngine {
    async fn complete(&self, prompt: &str) -> Result<String, OmbraError> {
        let model = Arc::clone(&self.model);
        let backend = Arc::clone(&self.backend);
        let prompt = prompt.to_owned();
        let max_tokens = self.max_tokens;

        task::spawn_blocking(move || run_inference(&model, &backend, &prompt, max_tokens))
            .await
            .map_err(|e| OmbraError::Inference(format!("thread join: {e}")))?
    }
}

fn run_inference(
    model: &LlamaModel,
    backend: &LlamaBackend,
    prompt: &str,
    max_tokens: i32,
) -> Result<String, OmbraError> {
    let ctx_params = LlamaContextParams::default();
    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|e| OmbraError::Inference(format!("context creation: {e}")))?;

    let prompt_tokens = model
        .str_to_token(prompt, AddBos::Always)
        .map_err(|e| OmbraError::Inference(format!("tokenization: {e}")))?;

    let batch_capacity = prompt_tokens.len() + max_tokens as usize;
    let mut batch = LlamaBatch::new(batch_capacity, 1);

    for (index, &token) in prompt_tokens.iter().enumerate() {
        let is_last_prompt_token = index == prompt_tokens.len() - 1;
        batch
            .add(token, index as i32, &[0], is_last_prompt_token)
            .map_err(|e| OmbraError::Inference(format!("batch add: {e}")))?;
    }

    ctx.decode(&mut batch)
        .map_err(|e| OmbraError::Inference(format!("initial decode: {e}")))?;

    let mut output = String::new();
    let eos_token = model.token_eos();
    let mut cursor = prompt_tokens.len() as i32;
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    for _ in 0..max_tokens {
        let logits = ctx.get_logits_ith(batch.n_tokens() - 1);

        let next_token = logits
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(id, _)| LlamaToken(id as i32))
            .ok_or_else(|| OmbraError::Inference("empty logits".to_string()))?;

        if next_token == eos_token {
            break;
        }

        let token_text = model
            .token_to_piece(next_token, &mut decoder, true, None)
            .map_err(|e| OmbraError::Inference(format!("token to string: {e}")))?;

        output.push_str(&token_text);

        batch.clear();
        batch
            .add(next_token, cursor, &[0], true)
            .map_err(|e| OmbraError::Inference(format!("batch add: {e}")))?;

        ctx.decode(&mut batch)
            .map_err(|e| OmbraError::Inference(format!("decode: {e}")))?;

        cursor += 1;
    }

    Ok(output)
}
