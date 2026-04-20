use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;

use crate::ingestion::IncomingTranscriptChunk;
use crate::state::AppState;

pub async fn handle_transcript_stream(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    while let Some(result) = socket.recv().await {
        match result {
            Ok(Message::Text(text)) => {
                match serde_json::from_str::<IncomingTranscriptChunk>(&text) {
                    Ok(chunk) => {
                        if let Err(error) = state.ingestion_pipeline.process(chunk).await {
                            tracing::error!(%error, "ingestion failed");
                        }
                    }
                    Err(error) => {
                        tracing::warn!(%error, "received malformed transcript chunk");
                    }
                }
            }
            Ok(Message::Close(_)) => break,
            Err(error) => {
                tracing::warn!(%error, "websocket error");
                break;
            }
            _ => {}
        }
    }
}
