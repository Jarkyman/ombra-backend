use std::path::Path;
use std::sync::Arc;

use serde::Deserialize;

use ombra_ai::inference::InferenceEngine;

use crate::db::{self, DatabasePool};
use crate::db::user_profile::InsertUserProfileParams;

const PROFILE_FILE: &str = "user_profile.toml";

#[derive(Debug, Deserialize)]
struct UserProfileFile {
    profile: ProfileFields,
}

#[derive(Debug, Deserialize)]
struct ProfileFields {
    name: Option<String>,
    occupation: Option<String>,
    location: Option<String>,
    important_people: Option<String>,
    current_projects: Option<String>,
    additional: Option<String>,
    created_at: Option<i64>,
}

pub async fn run_if_needed(
    pool: &DatabasePool,
    inference_engine: &Arc<dyn InferenceEngine>,
) -> Option<String> {
    match db::user_profile::get_profile(pool).await {
        Ok(Some(profile)) => {
            return profile.profile_summary;
        }
        Err(e) => {
            tracing::warn!(%e, "could not read user profile from DB");
            return None;
        }
        Ok(None) => {}
    }

    let profile_path = Path::new(PROFILE_FILE);
    if !profile_path.exists() {
        tracing::info!("no user_profile.toml found — skipping onboarding");
        return None;
    }

    let content = match std::fs::read_to_string(profile_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(%e, "could not read user_profile.toml");
            return None;
        }
    };

    let parsed: UserProfileFile = match toml::from_str(&content) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(%e, "could not parse user_profile.toml");
            return None;
        }
    };

    let fields = &parsed.profile;
    let created_at = fields.created_at.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64
    });

    let profile = match db::user_profile::insert_profile(
        pool,
        InsertUserProfileParams {
            name: non_empty(fields.name.clone()),
            occupation: non_empty(fields.occupation.clone()),
            location: non_empty(fields.location.clone()),
            important_people: non_empty(fields.important_people.clone()),
            current_projects: non_empty(fields.current_projects.clone()),
            additional: non_empty(fields.additional.clone()),
            created_at,
        },
    )
    .await
    {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(%e, "could not insert user profile");
            return None;
        }
    };

    let prompt = build_profile_prompt(&profile.name, &profile.occupation, &profile.location,
        &profile.important_people, &profile.current_projects, &profile.additional);

    let summary = match inference_engine.complete(&prompt).await {
        Ok(s) => s.trim().to_string(),
        Err(e) => {
            tracing::warn!(%e, "could not generate user profile summary");
            return None;
        }
    };

    if let Err(e) = db::user_profile::update_profile_summary(pool, &summary).await {
        tracing::warn!(%e, "could not save profile summary");
    }

    tracing::info!("user profile loaded from user_profile.toml");
    Some(summary)
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
        "Write a concise personal context summary (3-5 sentences) based on these facts about the user.\n\
         Write in third person. Include who they are, what they do, where they are, \
         who matters to them, and what they are focused on.\n\
         Write only the summary — no intro, no labels.\n\
         \n\
         Facts:\n\
         {facts}"
    )
}
