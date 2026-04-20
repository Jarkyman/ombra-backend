use std::sync::Arc;

use async_trait::async_trait;
use llama_cpp_2::{
    context::params::LlamaContextParams,
    llama_backend::LlamaBackend,
    llama_batch::LlamaBatch,
    model::{params::LlamaModelParams, AddBos, LlamaModel},
    sampling::LlamaSampler,
    token::LlamaToken,
};
use tokio::task;

use ombra_common::error::OmbraError;

use crate::inference::{InferenceEngine, InferenceEngineConfig};

pub struct LlamaCppInferenceEngine {
    model: Arc<LlamaModel>,
    backend: Arc<LlamaBackend>,
    context_size: u32,
    max_tokens: i32,
    chat_template: Option<String>,
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
            context_size: config.context_size,
            max_tokens: config.max_tokens as i32,
            chat_template: config.chat_template.clone(),
        })
    }

    fn apply_template(&self, prompt: &str) -> String {
        match &self.chat_template {
            Some(template) => template.replace("{prompt}", prompt),
            None => prompt.to_owned(),
        }
    }
}

#[async_trait]
impl InferenceEngine for LlamaCppInferenceEngine {
    async fn complete(&self, prompt: &str) -> Result<String, OmbraError> {
        let model = Arc::clone(&self.model);
        let backend = Arc::clone(&self.backend);
        let prompt = self.apply_template(prompt);
        let context_size = self.context_size;
        let max_tokens = self.max_tokens;

        task::spawn_blocking(move || run_inference(&model, &backend, &prompt, context_size, max_tokens))
            .await
            .map_err(|e| OmbraError::Inference(format!("thread join: {e}")))?
    }
}

fn build_sampler() -> LlamaSampler {
    LlamaSampler::chain_simple([
        LlamaSampler::penalties(-1, 1.3, 0.0, 0.0),
        LlamaSampler::temp(0.2),
        LlamaSampler::top_p(0.9, 1),
        LlamaSampler::dist(0),
    ])
}

fn run_inference(
    model: &LlamaModel,
    backend: &LlamaBackend,
    prompt: &str,
    context_size: u32,
    max_tokens: i32,
) -> Result<String, OmbraError> {
    let ctx_params = LlamaContextParams::default()
        .with_n_ctx(std::num::NonZeroU32::new(context_size));
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

    let mut sampler = build_sampler();
    sampler.accept_many(prompt_tokens.iter().copied());

    let mut output = String::new();
    let eos_token = model.token_eos();
    let mut cursor = prompt_tokens.len() as i32;
    let mut decoder = encoding_rs::UTF_8.new_decoder();

    for _ in 0..max_tokens {
        let next_token: LlamaToken = sampler.sample(&ctx, batch.n_tokens() - 1);
        sampler.accept(next_token);

        if next_token == eos_token || model.is_eog_token(next_token) {
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
