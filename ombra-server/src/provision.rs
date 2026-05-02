use std::path::PathBuf;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};

#[derive(Clone)]
pub struct ProvisionState {
    token_path: PathBuf,
    ca_cert_path: PathBuf,
    client_cert_path: PathBuf,
    client_key_path: PathBuf,
}

impl ProvisionState {
    pub fn new(
        token_path: PathBuf,
        ca_cert_path: PathBuf,
        client_cert_path: PathBuf,
        client_key_path: PathBuf,
    ) -> Self {
        Self {
            token_path,
            ca_cert_path,
            client_cert_path,
            client_key_path,
        }
    }

    fn consume_token(&self, presented: &str) -> bool {
        let stored = match std::fs::read_to_string(&self.token_path) {
            Ok(s) => s,
            Err(_) => return false,
        };

        stored.trim() == presented.trim()
    }
}

#[derive(Deserialize)]
struct CertsQuery {
    token: String,
}

#[derive(Serialize)]
struct CertsResponse {
    ca_cert: String,
    client_cert: String,
    client_key: String,
}

async fn handle_get_certs(
    Query(params): Query<CertsQuery>,
    State(state): State<ProvisionState>,
) -> Result<Json<CertsResponse>, StatusCode> {
    if !state.consume_token(&params.token) {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let ca_cert = read_pem(&state.ca_cert_path)?;
    let client_cert = read_pem(&state.client_cert_path)?;
    let client_key = read_pem(&state.client_key_path)?;

    tracing::info!(component = "provision", "certs delivered via provision token");

    Ok(Json(CertsResponse {
        ca_cert,
        client_cert,
        client_key,
    }))
}

fn read_pem(path: &std::path::Path) -> Result<String, StatusCode> {
    std::fs::read_to_string(path).map_err(|e| {
        tracing::error!(%e, path = %path.display(), "failed to read cert file");
        StatusCode::INTERNAL_SERVER_ERROR
    })
}

pub fn build_router(state: ProvisionState) -> Router {
    Router::new()
        .route("/provision/certs", get(handle_get_certs))
        .with_state(state)
}
