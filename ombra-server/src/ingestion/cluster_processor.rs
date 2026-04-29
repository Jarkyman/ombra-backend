use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use tokio::sync::{broadcast, mpsc};

use ombra_ai::{
    detect_iso639,
    embeddings::EmbeddingEngine,
    inference::InferenceEngine,
    vector_store::{ClusterPayload, EntityProfilePayload, QdrantVectorStore},
};
use ombra_common::error::OmbraError;

use crate::db::{self, DatabasePool};
use crate::db::cluster::InsertClusterParams;
use crate::db::entity::Entity;
use crate::events::ServerEvent;
use crate::ingestion::cluster::OpenCluster;

pub struct ClusterProcessor {
    database_pool: DatabasePool,
    inference_engine: Arc<dyn InferenceEngine>,
    embedding_engine: Arc<dyn EmbeddingEngine>,
    vector_store: Arc<QdrantVectorStore>,
    encryption_key: [u8; 32],
    profile_encounter_threshold: u32,
    event_sender: broadcast::Sender<ServerEvent>,
}

#[derive(Deserialize)]
struct ClusterScoreResponse {
    event_type: String,
    relevance_score: f32,
    event_summary: String,
}

#[derive(Deserialize)]
struct ExtractedEntity {
    name: String,
    entity_type: String,
}

impl ClusterProcessor {
    pub fn new(
        database_pool: DatabasePool,
        inference_engine: Arc<dyn InferenceEngine>,
        embedding_engine: Arc<dyn EmbeddingEngine>,
        vector_store: Arc<QdrantVectorStore>,
        encryption_key: [u8; 32],
        profile_encounter_threshold: u32,
        event_sender: broadcast::Sender<ServerEvent>,
    ) -> Self {
        Self {
            database_pool,
            inference_engine,
            embedding_engine,
            vector_store,
            encryption_key,
            profile_encounter_threshold,
            event_sender,
        }
    }

    pub fn spawn(self, mut receiver: mpsc::Receiver<OpenCluster>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            while let Some(open_cluster) = receiver.recv().await {
                let cluster_id = open_cluster.cluster_id.clone();
                if let Err(error) = self.process(open_cluster).await {
                    tracing::error!(%cluster_id, %error, "cluster processing failed");
                }
            }
        })
    }

    async fn process(&self, open_cluster: OpenCluster) -> Result<(), OmbraError> {
        let transcripts = db::transcript::get_transcripts_by_ids(
            &self.database_pool,
            &open_cluster.transcript_ids,
            &self.encryption_key,
        )
        .await?;

        if transcripts.is_empty() {
            return Ok(());
        }

        let transcript_texts: Vec<&str> = transcripts.iter().map(|t| t.content.as_str()).collect();
        let language = detect_iso639(&transcript_texts);
        let score = self.score_cluster(&transcript_texts).await?;

        tracing::info!(
            cluster_id = %open_cluster.cluster_id,
            event_type = %score.event_type,
            relevance_score = score.relevance_score,
            "cluster scored"
        );

        let closed_at = current_unix_timestamp();

        let cluster = db::cluster::insert_cluster_with_transcripts(
            &self.database_pool,
            InsertClusterParams {
                session_id: &open_cluster.session_id,
                started_at: open_cluster.started_at,
                closed_at,
                event_type: &score.event_type,
                relevance_score: score.relevance_score,
                event_summary: &score.event_summary,
                language: &language,
            },
            &open_cluster.transcript_ids,
        )
        .await?;

        let vector = self.embedding_engine.embed(&score.event_summary).await?;

        self.vector_store
            .upsert_cluster(
                &cluster.id,
                vector,
                ClusterPayload {
                    session_id: open_cluster.session_id.clone(),
                    event_type: score.event_type.clone(),
                    relevance_score: score.relevance_score,
                    language: language.clone(),
                    started_at: open_cluster.started_at,
                },
            )
            .await?;

        self.process_entities(&transcript_texts, &cluster.id, closed_at).await?;

        let _ = self.event_sender.send(ServerEvent::ClusterReady {
            session_id: open_cluster.session_id.clone(),
            cluster_id: cluster.id.clone(),
        });

        Ok(())
    }

    async fn process_entities(
        &self,
        transcript_texts: &[&str],
        cluster_id: &str,
        timestamp: i64,
    ) -> Result<(), OmbraError> {
        let extracted = match self.extract_entities(transcript_texts).await {
            Ok(entities) => entities,
            Err(error) => {
                tracing::warn!(%cluster_id, %error, "entity extraction failed — skipping");
                return Ok(());
            }
        };

        if extracted.is_empty() {
            return Ok(());
        }

        let mut entity_records: Vec<Entity> = Vec::with_capacity(extracted.len());

        for e in &extracted {
            let entity = db::entity::upsert_entity(
                &self.database_pool,
                &e.name,
                &e.entity_type,
                timestamp,
            )
            .await?;

            db::entity::link_entity_to_cluster(&self.database_pool, &entity.id, cluster_id).await?;

            if entity.encounter_count >= self.profile_encounter_threshold as i64 {
                self.generate_and_store_profile(&entity).await?;
            }

            entity_records.push(entity);
        }

        for i in 0..entity_records.len() {
            for j in (i + 1)..entity_records.len() {
                db::entity::upsert_entity_relationship(
                    &self.database_pool,
                    &entity_records[i].id,
                    &entity_records[j].id,
                    "co_occurrence",
                )
                .await?;
            }
        }

        tracing::info!(
            cluster_id = %cluster_id,
            entity_count = entity_records.len(),
            "entities processed"
        );

        Ok(())
    }

    async fn generate_and_store_profile(&self, entity: &Entity) -> Result<(), OmbraError> {
        let summaries = db::entity::get_cluster_summaries_for_entity(
            &self.database_pool,
            &entity.id,
        )
        .await?;

        if summaries.is_empty() {
            return Ok(());
        }

        let prompt = build_profile_prompt(&entity.name, &entity.entity_type, &summaries);
        let profile_summary = self.inference_engine.complete(&prompt).await?;
        let profile_summary = profile_summary.trim().to_string();

        db::entity::update_entity_profile(&self.database_pool, &entity.id, &profile_summary).await?;

        let vector = self.embedding_engine.embed(&profile_summary).await?;

        self.vector_store
            .upsert_entity_profile(
                &entity.id,
                vector,
                EntityProfilePayload {
                    name: entity.name.clone(),
                    entity_type: entity.entity_type.clone(),
                    encounter_count: entity.encounter_count,
                },
            )
            .await?;

        tracing::info!(
            entity_id = %entity.id,
            entity_name = %entity.name,
            encounter_count = entity.encounter_count,
            "entity profile generated"
        );

        Ok(())
    }

    async fn score_cluster(&self, transcript_texts: &[&str]) -> Result<ClusterScoreResponse, OmbraError> {
        let prompt = build_scoring_prompt(transcript_texts);
        let response = self.inference_engine.complete_structured(&prompt, 256).await?;

        let json_start = response.find('{').unwrap_or(0);
        let json_end = response.rfind('}').map(|i| i + 1).unwrap_or(response.len());
        let json_slice = &response[json_start..json_end];

        serde_json::from_str::<ClusterScoreResponse>(json_slice).map_err(|e| {
            OmbraError::Inference(format!(
                "failed to parse cluster score response: {e}\nraw response: {response}"
            ))
        })
    }

    async fn extract_entities(
        &self,
        transcript_texts: &[&str],
    ) -> Result<Vec<ExtractedEntity>, OmbraError> {
        let prompt = build_entity_extraction_prompt(transcript_texts);
        let response = self.inference_engine.complete_structured(&prompt, 256).await?;

        let json_start = response.find('[').unwrap_or(0);
        let json_end = response.rfind(']').map(|i| i + 1).unwrap_or(response.len());
        let json_slice = &response[json_start..json_end];

        serde_json::from_str::<Vec<ExtractedEntity>>(json_slice).map_err(|e| {
            OmbraError::Inference(format!(
                "failed to parse entity extraction response: {e}\nraw response: {response}"
            ))
        })
    }
}

fn build_entity_extraction_prompt(transcript_texts: &[&str]) -> String {
    let text = transcript_texts.join("\n");
    format!(
        "Extract named entities from these transcript segments.\n\
         \n\
         Entity types: person, place, project, topic\n\
         Rules:\n\
         - Only extract specific named things (first names, full names, named locations, project names, recurring topics)\n\
         - Ignore generic words and filler\n\
         - If no entities are present, return an empty array\n\
         \n\
         Respond with a JSON array only — no other text:\n\
         [{{\"name\": \"...\", \"entity_type\": \"person|place|project|topic\"}}]\n\
         \n\
         Transcripts:\n\
         {text}"
    )
}

fn build_profile_prompt(name: &str, entity_type: &str, summaries: &[String]) -> String {
    let context = summaries.join("\n- ");
    format!(
        "Based on these conversation summaries, write a concise profile of {name} ({entity_type}).\n\
         3-5 sentences. Include: who they are, context of interactions, recurring topics or projects.\n\
         Write only the profile — no intro, no labels.\n\
         \n\
         Summaries:\n\
         - {context}"
    )
}

fn build_scoring_prompt(transcript_texts: &[&str]) -> String {
    let transcripts = transcript_texts.join("\n");
    format!(
        "Analyze these audio transcript segments captured by a personal wearable device in a 5-minute window.\n\
         \n\
         Classify the event type as exactly one of: conversation, meeting, travel, arrival, ambient, noise\n\
         Score relevance 0.0-1.0 where:\n\
           0.0 = pure background noise with no personal relevance\n\
           1.0 = important personal event worth remembering\n\
         Write a concise event_summary (max 2 sentences) describing what happened and who was involved.\n\
         \n\
         Respond with valid JSON only — no other text before or after:\n\
         {{\"event_type\": \"...\", \"relevance_score\": 0.0, \"event_summary\": \"...\"}}\n\
         \n\
         Transcripts:\n\
         {transcripts}"
    )
}

fn current_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
