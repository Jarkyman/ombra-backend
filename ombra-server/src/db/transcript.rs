use sqlx::FromRow;
use uuid::Uuid;

use ombra_ai::detect_iso639;
use ombra_common::{encryption, error::OmbraError};

use super::DatabasePool;

#[derive(Debug, FromRow)]
pub struct Transcript {
    pub id: String,
    pub session_id: String,
    pub content: String,
    pub detected_language: String,
    pub recorded_at: i64,
}

pub async fn insert_transcript(
    pool: &DatabasePool,
    session_id: &str,
    content: &str,
    recorded_at: i64,
    encryption_key: &[u8; 32],
) -> Result<Transcript, OmbraError> {
    let id = Uuid::new_v4().to_string();
    let detected_language = detect_iso639(&[content]);
    let encrypted_content = encryption::encrypt(content, encryption_key)?;

    let row = sqlx::query_as::<_, Transcript>(
        "INSERT INTO transcripts (id, session_id, content, raw_whisper_text, detected_language, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING *",
    )
    .bind(&id)
    .bind(session_id)
    .bind(&encrypted_content)
    .bind(content)
    .bind(&detected_language)
    .bind(recorded_at)
    .fetch_one(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("insert transcript: {e}")))?;

    Ok(Transcript {
        content: content.to_owned(),
        ..row
    })
}

pub async fn get_transcripts_by_ids(
    pool: &DatabasePool,
    ids: &[String],
    encryption_key: &[u8; 32],
) -> Result<Vec<Transcript>, OmbraError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let query = format!(
        "SELECT * FROM transcripts WHERE id IN ({}) ORDER BY recorded_at ASC",
        placeholders
    );

    let mut q = sqlx::query_as::<_, Transcript>(&query);
    for id in ids {
        q = q.bind(id);
    }

    let rows = q
        .fetch_all(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("get transcripts by ids: {e}")))?;

    rows.into_iter()
        .map(|row| {
            let content = encryption::decrypt(&row.content, encryption_key)?;
            Ok(Transcript { content, ..row })
        })
        .collect()
}

#[derive(Debug, FromRow)]
pub struct TranscriptStub {
    pub id: String,
    pub session_id: String,
    pub recorded_at: i64,
}

pub async fn get_unassigned_transcript_stubs(
    pool: &DatabasePool,
) -> Result<Vec<TranscriptStub>, OmbraError> {
    sqlx::query_as::<_, TranscriptStub>(
        "SELECT id, session_id, recorded_at FROM transcripts WHERE cluster_id IS NULL ORDER BY recorded_at ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("get unassigned transcripts: {e}")))
}

pub async fn list_transcripts_by_session(
    pool: &DatabasePool,
    session_id: &str,
    encryption_key: &[u8; 32],
) -> Result<Vec<Transcript>, OmbraError> {
    let rows = sqlx::query_as::<_, Transcript>(
        "SELECT * FROM transcripts WHERE session_id = ? ORDER BY recorded_at ASC",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list transcripts: {e}")))?;

    rows.into_iter()
        .map(|row| {
            let content = encryption::decrypt(&row.content, encryption_key)?;
            Ok(Transcript { content, ..row })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::create_test_db;
    use ombra_common::encryption;

    fn test_key() -> [u8; 32] {
        encryption::parse_key(&encryption::generate_key()).unwrap()
    }

    #[tokio::test]
    async fn insert_and_read_back_decrypts_correctly() {
        let pool = create_test_db().await;
        let key = test_key();
        let original = "We will meet again on Friday at 14:00";

        let inserted = insert_transcript(&pool, "session-1", original, 1000, &key).await.unwrap();
        assert_eq!(inserted.content, original);

        let transcripts = list_transcripts_by_session(&pool, "session-1", &key).await.unwrap();
        assert_eq!(transcripts.len(), 1);
        assert_eq!(transcripts[0].content, original);
    }

    #[tokio::test]
    async fn raw_db_content_is_not_plaintext() {
        let pool = create_test_db().await;
        let key = test_key();
        let plaintext = "this should not appear in the database";

        insert_transcript(&pool, "session-1", plaintext, 1000, &key).await.unwrap();

        let raw_row = sqlx::query_as::<_, Transcript>(
            "SELECT * FROM transcripts WHERE session_id = 'session-1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(!raw_row.content.contains(plaintext), "plaintext found in raw DB row");
    }

    #[tokio::test]
    async fn wrong_key_returns_error() {
        let pool = create_test_db().await;
        let key_a = test_key();
        let key_b = test_key();

        insert_transcript(&pool, "session-1", "secret", 1000, &key_a).await.unwrap();
        let result = list_transcripts_by_session(&pool, "session-1", &key_b).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn list_by_session_returns_chronological_order() {
        let pool = create_test_db().await;
        let key = test_key();

        insert_transcript(&pool, "session-1", "third",  3000, &key).await.unwrap();
        insert_transcript(&pool, "session-1", "first",  1000, &key).await.unwrap();
        insert_transcript(&pool, "session-1", "second", 2000, &key).await.unwrap();

        let transcripts = list_transcripts_by_session(&pool, "session-1", &key).await.unwrap();
        assert_eq!(transcripts[0].content, "first");
        assert_eq!(transcripts[1].content, "second");
        assert_eq!(transcripts[2].content, "third");
    }

    #[tokio::test]
    async fn list_by_session_excludes_other_sessions() {
        let pool = create_test_db().await;
        let key = test_key();

        insert_transcript(&pool, "session-a", "belongs to a", 1000, &key).await.unwrap();
        insert_transcript(&pool, "session-b", "belongs to b", 2000, &key).await.unwrap();

        let result = list_transcripts_by_session(&pool, "session-a", &key).await.unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].content, "belongs to a");
    }
}
