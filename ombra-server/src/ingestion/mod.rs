pub mod cluster;
pub mod cluster_processor;

use std::sync::{Arc, Mutex};

use serde::Deserialize;
use tokio::sync::mpsc;

use ombra_common::error::OmbraError;

use crate::db::{self, DatabasePool};

use cluster::{ClusterManager, OpenCluster};

pub struct IngestionPipeline {
    database_pool: DatabasePool,
    cluster_manager: Arc<Mutex<ClusterManager>>,
    cluster_sender: mpsc::Sender<OpenCluster>,
    encryption_key: [u8; 32],
}

#[derive(Deserialize)]
pub struct IncomingTranscriptChunk {
    pub session_id: String,
    pub text: String,
    pub recorded_at: i64,
}

impl IngestionPipeline {
    pub fn new(
        database_pool: DatabasePool,
        cluster_timeout_minutes: u64,
        cluster_sender: mpsc::Sender<OpenCluster>,
        encryption_key: [u8; 32],
    ) -> Self {
        Self {
            database_pool,
            cluster_manager: Arc::new(Mutex::new(ClusterManager::new(cluster_timeout_minutes))),
            cluster_sender,
            encryption_key,
        }
    }

    pub async fn flush_session(&self, session_id: &str) -> Result<(), OmbraError> {
        let cluster = {
            let mut manager = self
                .cluster_manager
                .lock()
                .map_err(|_| OmbraError::Storage("cluster manager lock poisoned".to_string()))?;
            manager.close_cluster(session_id)
        };

        if let Some(cluster) = cluster {
            tracing::info!(
                cluster_id = %cluster.cluster_id,
                session_id = %session_id,
                transcript_count = cluster.transcript_ids.len(),
                "session disconnected — flushing open cluster"
            );
            if let Err(error) = self.cluster_sender.send(cluster).await {
                tracing::error!(%error, "cluster channel closed unexpectedly during flush");
            }
        }

        Ok(())
    }

    pub async fn process(&self, chunk: IncomingTranscriptChunk) -> Result<(), OmbraError> {
        if is_empty_transcript(&chunk.text) {
            return Ok(());
        }

        let transcript = db::transcript::insert_transcript(
            &self.database_pool,
            &chunk.session_id,
            &chunk.text,
            chunk.recorded_at,
            &self.encryption_key,
        )
        .await?;

        let expired = {
            let mut manager = self
                .cluster_manager
                .lock()
                .map_err(|_| OmbraError::Storage("cluster manager lock poisoned".to_string()))?;

            manager.add_transcript(&chunk.session_id, &transcript.id);
            manager.drain_expired_clusters()
        };

        for cluster in expired {
            tracing::info!(
                cluster_id = %cluster.cluster_id,
                transcript_count = cluster.transcript_ids.len(),
                "cluster closed — sending to processor"
            );

            if let Err(error) = self.cluster_sender.send(cluster).await {
                tracing::error!(%error, "cluster channel closed unexpectedly");
            }
        }

        Ok(())
    }
}

fn is_empty_transcript(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }
    matches!(
        trimmed.to_ascii_uppercase().as_str(),
        "[BLANK_AUDIO]" | "[BLANK]" | "[NO_SPEECH]" | "[SILENCE]"
    )
}

#[cfg(test)]
mod tests {
    use super::is_empty_transcript;

    #[test]
    fn rejects_blank_audio_tag() {
        assert!(is_empty_transcript("[BLANK_AUDIO]"));
    }

    #[test]
    fn rejects_all_known_empty_tags() {
        for tag in ["[BLANK_AUDIO]", "[BLANK]", "[NO_SPEECH]", "[SILENCE]"] {
            assert!(is_empty_transcript(tag), "{tag} should be rejected");
        }
    }

    #[test]
    fn rejects_tags_regardless_of_case() {
        assert!(is_empty_transcript("[blank_audio]"));
        assert!(is_empty_transcript("[Blank_Audio]"));
        assert!(is_empty_transcript("[BLANK_AUDIO]"));
    }

    #[test]
    fn rejects_whitespace_only() {
        assert!(is_empty_transcript("   "));
        assert!(is_empty_transcript("\t\n"));
        assert!(is_empty_transcript(""));
    }

    #[test]
    fn rejects_tag_with_surrounding_whitespace() {
        assert!(is_empty_transcript("  [BLANK_AUDIO]  "));
    }

    #[test]
    fn accepts_real_content() {
        assert!(!is_empty_transcript("We will meet again on Friday"));
        assert!(!is_empty_transcript("hello"));
        assert!(!is_empty_transcript("a"));
    }

    #[test]
    fn accepts_content_that_contains_a_tag() {
        assert!(!is_empty_transcript("He said [BLANK_AUDIO] and continued talking"));
    }
}
