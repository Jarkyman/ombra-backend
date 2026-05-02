use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Serialize;

use crate::db;
use crate::state::AppState;

#[derive(Serialize)]
pub struct DeviceResponse {
    pub cn: String,
    pub label: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub revoked: bool,
}

pub async fn list(State(state): State<AppState>) -> impl IntoResponse {
    match db::device::list_devices(&state.database_pool).await {
        Ok(devices) => Json(
            devices
                .into_iter()
                .map(|d| DeviceResponse {
                    cn: d.cn,
                    label: d.label,
                    first_seen: d.first_seen,
                    last_seen: d.last_seen,
                    revoked: d.revoked_at.is_some(),
                })
                .collect::<Vec<_>>(),
        )
        .into_response(),
        Err(error) => {
            tracing::error!(%error, "list trusted devices");
            super::internal_error()
        }
    }
}

pub async fn revoke(State(state): State<AppState>, Path(cn): Path<String>) -> impl IntoResponse {
    let now = current_timestamp();

    match db::device::revoke_device(&state.database_pool, &cn, now).await {
        Ok(true) => {
            tracing::info!(component = "devices", %cn, "device revoked");
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(false) => super::not_found(),
        Err(error) => {
            tracing::error!(%error, "revoke device");
            super::internal_error()
        }
    }
}

pub async fn delete(State(state): State<AppState>, Path(cn): Path<String>) -> impl IntoResponse {
    match db::device::delete_device(&state.database_pool, &cn).await {
        Ok(true) => StatusCode::NO_CONTENT.into_response(),
        Ok(false) => super::not_found(),
        Err(error) => {
            tracing::error!(%error, "delete trusted device");
            super::internal_error()
        }
    }
}

fn current_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
