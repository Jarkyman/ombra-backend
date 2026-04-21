use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};

use ombra_common::error::OmbraError;

use crate::db;
use crate::state::AppState;

const CLUSTER_SEARCH_LIMIT: u64 = 6;
const ENTITY_SEARCH_LIMIT: u64 = 3;

#[derive(Deserialize)]
pub struct QueryRequest {
    pub text: String,
}

#[derive(Serialize)]
pub struct QuerySource {
    pub cluster_id: String,
    pub event_type: String,
    pub event_summary: String,
    pub started_at: i64,
}

#[derive(Serialize)]
pub struct QueryResponse {
    pub answer: String,
    pub sources: Vec<QuerySource>,
}

pub async fn handle(
    State(state): State<AppState>,
    Json(request): Json<QueryRequest>,
) -> impl IntoResponse {
    match run_query(state, request.text).await {
        Ok(response) => (StatusCode::OK, Json(response)).into_response(),
        Err(error) => {
            tracing::error!(%error, "query failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn run_query(state: AppState, query_text: String) -> Result<QueryResponse, OmbraError> {
    let query_vector = state.embedding_engine.embed(&query_text).await?;

    let (cluster_results, entity_results) = tokio::try_join!(
        state.vector_store.search(query_vector.clone(), CLUSTER_SEARCH_LIMIT),
        state.vector_store.search_entities(query_vector, ENTITY_SEARCH_LIMIT),
    )?;

    let response_language = state.config.read().unwrap().response_language.clone();
    let user_profile = state.user_profile_summary.read().unwrap().clone();

    let cluster_ids: Vec<String> = cluster_results.iter().map(|r| r.cluster_id.clone()).collect();
    let clusters = db::cluster::get_clusters_by_ids(&state.database_pool, &cluster_ids).await?;

    let entity_ids: Vec<String> = entity_results.iter().map(|r| r.entity_id.clone()).collect();
    let entities = db::entity::get_entities_by_ids(&state.database_pool, &entity_ids).await?;

    let event_context = clusters
        .iter()
        .map(|c| format!("[{}] {}", c.event_type, c.event_summary))
        .collect::<Vec<_>>()
        .join("\n");

    let entity_context: Vec<String> = entities
        .iter()
        .filter_map(|e| {
            e.profile_summary
                .as_deref()
                .map(|p| format!("{} ({}): {}", e.name, e.entity_type, p))
        })
        .collect();
    let prompt = build_rag_prompt(&query_text, &event_context, &entity_context, &user_profile, &response_language);
    let answer = state.inference_engine.complete(&prompt).await?;

    let sources = clusters
        .into_iter()
        .map(|c| QuerySource {
            cluster_id: c.id,
            event_type: c.event_type,
            event_summary: c.event_summary,
            started_at: c.started_at,
        })
        .collect();

    Ok(QueryResponse { answer, sources })
}

fn build_rag_prompt(
    query: &str,
    event_context: &str,
    entity_context: &[String],
    user_profile: &Option<String>,
    response_language: &str,
) -> String {
    let profile_section = match user_profile {
        Some(p) => format!("About the user:\n{p}\n\n"),
        None => String::new(),
    };

    let entity_section = if entity_context.is_empty() {
        String::new()
    } else {
        format!("\nKnown people & places:\n{}\n", entity_context.join("\n"))
    };

    format!(
        "You are a personal memory recall system. Respond in language code: {response_language}\n\
         \n\
         Rules:\n\
         - State only what was captured — no conclusions, no analysis\n\
         - No filler like \"Based on your transcripts\" or \"It appears that\"\n\
         - Use short bullet points for multiple facts, one sentence for a single fact\n\
         - If nothing was captured about the question: say so briefly in the response language\n\
         \n\
         {profile_section}\
         Captured events:\n\
         {event_context}\
         {entity_section}\n\
         Question: {query}"
    )
}
