use axum::{
    Json,
    extract::State,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

use crate::state::AppState;

#[derive(Serialize)]
pub struct SettingsResponse {
    pub response_language: String,
    pub cluster_timeout_minutes: u64,
    pub profile_encounter_threshold: u32,
}

#[derive(Deserialize)]
pub struct SettingsUpdate {
    pub response_language: Option<String>,
    pub cluster_timeout_minutes: Option<u64>,
    pub profile_encounter_threshold: Option<u32>,
}

pub async fn get(State(state): State<AppState>) -> impl IntoResponse {
    let config = state.config.read().unwrap();
    Json(SettingsResponse {
        response_language: config.response_language.clone(),
        cluster_timeout_minutes: config.cluster_timeout_minutes,
        profile_encounter_threshold: config.profile_encounter_threshold,
    })
    .into_response()
}

pub async fn update(
    State(state): State<AppState>,
    Json(update): Json<SettingsUpdate>,
) -> impl IntoResponse {
    {
        let mut config = state.config.write().unwrap();

        if let Some(lang) = update.response_language {
            config.response_language = lang;
        }
        if let Some(timeout) = update.cluster_timeout_minutes {
            config.cluster_timeout_minutes = timeout;
        }
        if let Some(threshold) = update.profile_encounter_threshold {
            config.profile_encounter_threshold = threshold;
        }
    }

    let config = state.config.read().unwrap();
    if let Err(error) = config.save(&state.config_path) {
        tracing::error!(%error, "failed to persist settings to disk");
        return super::internal_error();
    }

    Json(SettingsResponse {
        response_language: config.response_language.clone(),
        cluster_timeout_minutes: config.cluster_timeout_minutes,
        profile_encounter_threshold: config.profile_encounter_threshold,
    })
    .into_response()
}
