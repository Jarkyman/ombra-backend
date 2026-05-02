use axum::{Json, extract::State, response::IntoResponse};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::state::AppState;

#[derive(Serialize)]
pub struct ProfileResponse {
    pub name: Option<String>,
    pub occupation: Option<String>,
    pub location: Option<String>,
    pub important_people: Option<String>,
    pub current_projects: Option<String>,
    pub additional: Option<String>,
    pub summary: Option<String>,
}

#[derive(Deserialize)]
pub struct ProfileUpdate {
    pub name: Option<String>,
    pub occupation: Option<String>,
    pub location: Option<String>,
    pub important_people: Option<String>,
    pub current_projects: Option<String>,
    pub additional: Option<String>,
}

#[derive(Serialize)]
pub struct RegenerateResponse {
    pub summary: String,
}

pub async fn get(State(state): State<AppState>) -> impl IntoResponse {
    build_profile_response(&state).await
}

async fn build_profile_response(state: &AppState) -> axum::response::Response {
    let (profile_opt, facts) = match tokio::join!(
        db::user_profile::get_profile(&state.database_pool),
        db::profile_facts::get_facts(&state.database_pool),
    ) {
        (Ok(p), Ok(f)) => (p, f),
        (Err(error), _) | (_, Err(error)) => {
            tracing::error!(%error, "get user profile");
            return super::internal_error();
        }
    };

    let find = |key: &str| -> Option<String> {
        facts.iter().find(|f| f.key == key).map(|f| f.value.clone())
    };

    Json(ProfileResponse {
        name:             find("name"),
        occupation:       find("occupation"),
        location:         find("location"),
        important_people: find("important_people"),
        current_projects: find("current_projects"),
        additional:       find("additional"),
        summary:          profile_opt.and_then(|p| p.profile_summary),
    })
    .into_response()
}

pub async fn update(
    State(state): State<AppState>,
    Json(body): Json<ProfileUpdate>,
) -> impl IntoResponse {
    let fields = [
        ("name",             body.name),
        ("occupation",       body.occupation),
        ("location",         body.location),
        ("important_people", body.important_people),
        ("current_projects", body.current_projects),
        ("additional",       body.additional),
    ];

    for (key, value) in fields {
        match non_empty(value) {
            Some(v) => {
                if let Err(error) =
                    db::profile_facts::upsert_fact(&state.database_pool, key, &v, "admin").await
                {
                    tracing::error!(%error, key, "update profile fact");
                    return super::internal_error();
                }
            }
            None => {
                if let Err(error) =
                    db::profile_facts::delete_fact(&state.database_pool, key).await
                {
                    tracing::error!(%error, key, "delete profile fact");
                    return super::internal_error();
                }
            }
        }
    }

    build_profile_response(&state).await
}

pub async fn regenerate(State(state): State<AppState>) -> impl IntoResponse {
    let facts = match db::profile_facts::get_facts(&state.database_pool).await {
        Ok(f) => f,
        Err(error) => {
            tracing::error!(%error, "get profile facts for regeneration");
            return super::internal_error();
        }
    };

    let find = |key: &str| -> Option<String> {
        facts.iter().find(|f| f.key == key).map(|f| f.value.clone())
    };

    let prompt = build_profile_prompt(
        &find("name"),
        &find("occupation"),
        &find("location"),
        &find("important_people"),
        &find("current_projects"),
        &find("additional"),
    );

    let summary = match state.inference_engine.complete(&prompt).await {
        Ok(s) => s.trim().to_string(),
        Err(error) => {
            tracing::error!(%error, "inference for profile regeneration");
            return super::internal_error();
        }
    };

    if let Err(error) =
        db::user_profile::update_profile_summary(&state.database_pool, &summary).await
    {
        tracing::error!(%error, "save regenerated profile summary");
        return super::internal_error();
    }

    *state.user_profile_summary.write().unwrap() = Some(summary.clone());

    Json(RegenerateResponse { summary }).into_response()
}

fn non_empty(s: Option<String>) -> Option<String> {
    s.filter(|v| !v.trim().is_empty())
}

fn build_profile_prompt(
    name: &Option<String>,
    occupation: &Option<String>,
    location: &Option<String>,
    important_people: &Option<String>,
    current_projects: &Option<String>,
    additional: &Option<String>,
) -> String {
    let mut lines = Vec::new();
    if let Some(v) = name             { lines.push(format!("Name: {v}")); }
    if let Some(v) = occupation       { lines.push(format!("Occupation: {v}")); }
    if let Some(v) = location         { lines.push(format!("Location: {v}")); }
    if let Some(v) = important_people { lines.push(format!("Important people: {v}")); }
    if let Some(v) = current_projects { lines.push(format!("Current projects: {v}")); }
    if let Some(v) = additional       { lines.push(format!("Additional context: {v}")); }

    let facts = lines.join("\n");

    format!(
        "Write a short, natural profile (2-3 sentences) about a person from the facts below.\n\
         Write in third person. Keep it human and varied — avoid starting every sentence with their name, and don't list facts mechanically.\n\
         Weave the details together naturally. The person IS the subject — people listed under \"Important people\" are others in their life, not the person themselves.\n\
         Write only the profile — no intro, no labels.\n\
         \n\
         Facts about the person:\n\
         {facts}"
    )
}
