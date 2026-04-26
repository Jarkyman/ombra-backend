use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::response::IntoResponse;
use tokio::select;
use tokio::sync::broadcast;

use crate::ingestion::IncomingTranscriptChunk;
use crate::state::AppState;

pub async fn handle_transcript_stream(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut event_rx = state.event_broadcast.subscribe();

    loop {
        select! {
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
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
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(error)) => {
                        tracing::warn!(%error, "websocket error");
                        break;
                    }
                    Some(Ok(_)) => {}
                }
            }
            event = event_rx.recv() => {
                match event {
                    Ok(event) => {
                        if let Ok(json) = serde_json::to_string(&event) {
                            if socket.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {}
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }
}
