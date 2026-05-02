use std::path::Path;
use std::sync::Arc;

use serde::Deserialize;

use ombra_ai::inference::InferenceEngine;

use crate::db::{self, DatabasePool};

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
        Ok(Some(profile)) => return profile.profile_summary,
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

    if let Err(e) = db::user_profile::create_default_profile(pool, created_at).await {
        tracing::warn!(%e, "could not create user profile row");
        return None;
    }

    let facts = vec![
        ("name".to_string(),             fields.name.clone().unwrap_or_default()),
        ("occupation".to_string(),       fields.occupation.clone().unwrap_or_default()),
        ("location".to_string(),         fields.location.clone().unwrap_or_default()),
        ("important_people".to_string(), fields.important_people.clone().unwrap_or_default()),
        ("current_projects".to_string(), fields.current_projects.clone().unwrap_or_default()),
        ("additional".to_string(),       fields.additional.clone().unwrap_or_default()),
    ];

    if let Err(e) = db::profile_facts::upsert_facts(pool, &facts, "onboarding").await {
        tracing::warn!(%e, "could not insert profile facts");
    }

    let prompt = build_profile_prompt(
        &fields.name,
        &fields.occupation,
        &fields.location,
        &fields.important_people,
        &fields.current_projects,
        &fields.additional,
    );

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
