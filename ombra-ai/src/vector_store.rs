use std::collections::HashMap;

use qdrant_client::{
    Qdrant,
    qdrant::{
        CreateCollectionBuilder, Distance, PointStruct,
        SearchPointsBuilder, UpsertPointsBuilder, VectorParamsBuilder,
        point_id::PointIdOptions,
    },
};
use serde::{Deserialize, Serialize};

use ombra_common::error::OmbraError;

use crate::embeddings::EMBEDDING_DIMENSIONS;

pub struct QdrantVectorStore {
    client: Qdrant,
    collection_name: String,
    entity_collection_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterPayload {
    pub session_id: String,
    pub event_type: String,
    pub relevance_score: f32,
    pub language: String,
    pub started_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EntityProfilePayload {
    pub name: String,
    pub entity_type: String,
    pub encounter_count: i64,
}

#[derive(Debug)]
pub struct ScoredCluster {
    pub cluster_id: String,
    pub score: f32,
}

#[derive(Debug)]
pub struct ScoredEntity {
    pub entity_id: String,
    pub score: f32,
}

impl QdrantVectorStore {
    pub async fn connect(url: &str, collection_name: impl Into<String>) -> Result<Self, OmbraError> {
        let client = Qdrant::from_url(url)
            .build()
            .map_err(|e| OmbraError::Storage(format!("qdrant connect: {e}")))?;

        let collection_name = collection_name.into();
        let entity_collection_name = format!("{collection_name}_entities");

        let store = Self { client, collection_name, entity_collection_name };

        store.ensure_collection_exists(&store.collection_name).await?;
        store.ensure_collection_exists(&store.entity_collection_name).await?;
        Ok(store)
    }

    async fn ensure_collection_exists(&self, name: &str) -> Result<(), OmbraError> {
        let collections = self
            .client
            .list_collections()
            .await
            .map_err(|e| OmbraError::Storage(format!("list collections: {e}")))?;

        if collections.collections.iter().any(|c| c.name == name) {
            return Ok(());
        }

        self.client
            .create_collection(
                CreateCollectionBuilder::new(name)
                    .vectors_config(VectorParamsBuilder::new(EMBEDDING_DIMENSIONS, Distance::Cosine)),
            )
            .await
            .map_err(|e| OmbraError::Storage(format!("create collection {name}: {e}")))?;

        Ok(())
    }

    pub async fn upsert_cluster(
        &self,
        cluster_id: &str,
        vector: Vec<f32>,
        payload: ClusterPayload,
    ) -> Result<(), OmbraError> {
        let payload_map: HashMap<String, qdrant_client::qdrant::Value> =
            serde_json::from_value(serde_json::to_value(&payload).unwrap()).unwrap_or_default();

        let point = PointStruct::new(cluster_id.to_string(), vector, payload_map);

        self.client
            .upsert_points(UpsertPointsBuilder::new(&self.collection_name, vec![point]))
            .await
            .map_err(|e| OmbraError::Storage(format!("upsert cluster: {e}")))?;

        Ok(())
    }

    pub async fn search(
        &self,
        vector: Vec<f32>,
        limit: u64,
    ) -> Result<Vec<ScoredCluster>, OmbraError> {
        let results = self
            .client
            .search_points(SearchPointsBuilder::new(&self.collection_name, vector, limit))
            .await
            .map_err(|e| OmbraError::Storage(format!("search: {e}")))?;

        Ok(results
            .result
            .into_iter()
            .filter_map(|r| {
                let cluster_id = match r.id?.point_id_options? {
                    PointIdOptions::Uuid(s) => s,
                    PointIdOptions::Num(n) => n.to_string(),
                };
                Some(ScoredCluster { cluster_id, score: r.score })
            })
            .collect())
    }

    pub async fn upsert_entity_profile(
        &self,
        entity_id: &str,
        vector: Vec<f32>,
        payload: EntityProfilePayload,
    ) -> Result<(), OmbraError> {
        let payload_map: HashMap<String, qdrant_client::qdrant::Value> =
            serde_json::from_value(serde_json::to_value(&payload).unwrap()).unwrap_or_default();

        let point = PointStruct::new(entity_id.to_string(), vector, payload_map);

        self.client
            .upsert_points(UpsertPointsBuilder::new(&self.entity_collection_name, vec![point]))
            .await
            .map_err(|e| OmbraError::Storage(format!("upsert entity profile: {e}")))?;

        Ok(())
    }

    pub async fn search_entities(
        &self,
        vector: Vec<f32>,
        limit: u64,
    ) -> Result<Vec<ScoredEntity>, OmbraError> {
        let results = self
            .client
            .search_points(SearchPointsBuilder::new(&self.entity_collection_name, vector, limit))
            .await
            .map_err(|e| OmbraError::Storage(format!("search entities: {e}")))?;

        Ok(results
            .result
            .into_iter()
            .filter_map(|r| {
                let entity_id = match r.id?.point_id_options? {
                    PointIdOptions::Uuid(s) => s,
                    PointIdOptions::Num(n) => n.to_string(),
                };
                Some(ScoredEntity { entity_id, score: r.score })
            })
            .collect())
    }
}
