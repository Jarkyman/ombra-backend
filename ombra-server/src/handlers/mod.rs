pub mod analytics;
pub mod clusters;
pub mod entities;
pub mod health;
pub mod query;
pub mod sessions;
pub mod settings;
pub mod websocket;

use axum::{Json, http::StatusCode, response::{IntoResponse, Response}};
use serde::Serialize;

#[derive(Serialize)]
struct ErrorBody {
    error: &'static str,
    message: &'static str,
}

pub fn internal_error() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorBody {
            error: "ERR_INTERNAL",
            message: "An internal server error occurred.",
        }),
    )
        .into_response()
}

pub fn not_found() -> Response {
    (
        StatusCode::NOT_FOUND,
        Json(ErrorBody {
            error: "ERR_NOT_FOUND",
            message: "The requested resource was not found.",
        }),
    )
        .into_response()
}
