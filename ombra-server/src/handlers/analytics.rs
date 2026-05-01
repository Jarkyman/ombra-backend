use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct ActivityParams {
    #[serde(default = "default_range")]
    range: String,
}

fn default_range() -> String {
    "30d".to_string()
}

fn range_to_cutoff(range: &str) -> Option<i64> {
    let days: u64 = match range {
        "7d" => 7,
        "30d" => 30,
        "90d" => 90,
        "all" => return None,
        _ => 30,
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    Some((now - days * 86400) as i64)
}

// GET /admin/analytics/overview
#[derive(Serialize)]
pub struct OverviewResponse {
    total_transcripts: i64,
    total_clusters: i64,
    total_entities: i64,
    entities_with_profile: i64,
    db_size_bytes: i64,
}

pub async fn overview(State(state): State<AppState>) -> impl IntoResponse {
    match db::analytics::get_overview(&state.database_pool).await {
        Ok(stats) => (
            StatusCode::OK,
            Json(OverviewResponse {
                total_transcripts: stats.total_transcripts,
                total_clusters: stats.total_clusters,
                total_entities: stats.total_entities,
                entities_with_profile: stats.entities_with_profile,
                db_size_bytes: stats.db_size_bytes,
            }),
        )
            .into_response(),
        Err(error) => {
            tracing::error!(%error, "analytics overview failed");
            super::internal_error()
        }
    }
}

// GET /admin/analytics/activity?range=30d
#[derive(Serialize)]
pub struct DayActivityResponse {
    date: String,
    clusters: i64,
    new_entities: i64,
    avg_relevance: f64,
}

#[derive(Serialize)]
pub struct ActivityResponse {
    range: String,
    days: Vec<DayActivityResponse>,
}

pub async fn activity(
    State(state): State<AppState>,
    Query(params): Query<ActivityParams>,
) -> impl IntoResponse {
    let cutoff = range_to_cutoff(&params.range);
    match db::analytics::get_activity(&state.database_pool, cutoff).await {
        Ok(days) => {
            let body = ActivityResponse {
                range: params.range,
                days: days
                    .into_iter()
                    .map(|d| DayActivityResponse {
                        date: d.date,
                        clusters: d.clusters,
                        new_entities: d.new_entities,
                        avg_relevance: (d.avg_relevance * 1000.0).round() / 1000.0,
                    })
                    .collect(),
            };
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "analytics activity failed");
            super::internal_error()
        }
    }
}

// GET /admin/analytics/entities
#[derive(Serialize)]
pub struct TopEntityResponse {
    id: String,
    name: String,
    entity_type: String,
    encounter_count: i64,
}

#[derive(Serialize)]
pub struct EncounterBucketResponse {
    bucket: String,
    count: i64,
}

#[derive(Serialize)]
pub struct EntityStatsResponse {
    top_entities: Vec<TopEntityResponse>,
    entities_with_profile: i64,
    encounter_distribution: Vec<EncounterBucketResponse>,
}

pub async fn entities(State(state): State<AppState>) -> impl IntoResponse {
    match db::analytics::get_entity_stats(&state.database_pool).await {
        Ok(stats) => {
            let body = EntityStatsResponse {
                top_entities: stats
                    .top_entities
                    .into_iter()
                    .map(|e| TopEntityResponse {
                        id: e.id,
                        name: e.name,
                        entity_type: e.entity_type,
                        encounter_count: e.encounter_count,
                    })
                    .collect(),
                entities_with_profile: stats.entities_with_profile,
                encounter_distribution: stats
                    .encounter_distribution
                    .into_iter()
                    .map(|b| EncounterBucketResponse {
                        bucket: b.bucket,
                        count: b.count,
                    })
                    .collect(),
            };
            (StatusCode::OK, Json(body)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "analytics entities failed");
            super::internal_error()
        }
    }
}

// GET /admin/analytics/languages
#[derive(Serialize)]
pub struct LanguageEntryResponse {
    language: String,
    count: i64,
    percentage: f64,
}

#[derive(Serialize)]
pub struct LanguagesResponse {
    languages: Vec<LanguageEntryResponse>,
}

pub async fn languages(State(state): State<AppState>) -> impl IntoResponse {
    match db::analytics::get_language_distribution(&state.database_pool).await {
        Ok(rows) => {
            let total: i64 = rows.iter().map(|r| r.count).sum();
            let languages = rows
                .into_iter()
                .map(|r| {
                    let percentage = if total > 0 {
                        (r.count as f64 / total as f64 * 1000.0).round() / 10.0
                    } else {
                        0.0
                    };
                    LanguageEntryResponse {
                        language: r.language,
                        count: r.count,
                        percentage,
                    }
                })
                .collect();
            (StatusCode::OK, Json(LanguagesResponse { languages })).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "analytics languages failed");
            super::internal_error()
        }
    }
}

// GET /admin/analytics/event-types
#[derive(Serialize)]
pub struct EventTypeEntryResponse {
    event_type: String,
    count: i64,
    percentage: f64,
}

#[derive(Serialize)]
pub struct EventTypesResponse {
    event_types: Vec<EventTypeEntryResponse>,
}

pub async fn event_types(State(state): State<AppState>) -> impl IntoResponse {
    match db::analytics::get_event_type_distribution(&state.database_pool).await {
        Ok(rows) => {
            let total: i64 = rows.iter().map(|r| r.count).sum();
            let event_types = rows
                .into_iter()
                .map(|r| {
                    let percentage = if total > 0 {
                        (r.count as f64 / total as f64 * 1000.0).round() / 10.0
                    } else {
                        0.0
                    };
                    EventTypeEntryResponse {
                        event_type: r.event_type,
                        count: r.count,
                        percentage,
                    }
                })
                .collect();
            (StatusCode::OK, Json(EventTypesResponse { event_types })).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "analytics event types failed");
            super::internal_error()
        }
    }
}
