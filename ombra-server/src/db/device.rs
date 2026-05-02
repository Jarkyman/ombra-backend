use sqlx::FromRow;

use ombra_common::error::OmbraError;

use super::DatabasePool;

#[derive(Debug, FromRow)]
pub struct TrustedDevice {
    pub cn: String,
    pub label: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub revoked_at: Option<i64>,
}

pub async fn upsert_device(
    pool: &DatabasePool,
    cn: &str,
    label: &str,
    now: i64,
) -> Result<(), OmbraError> {
    sqlx::query(
        "INSERT INTO trusted_devices (cn, label, first_seen, last_seen)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(cn) DO UPDATE SET last_seen = excluded.last_seen",
    )
    .bind(cn)
    .bind(label)
    .bind(now)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("upsert trusted device: {e}")))?;

    Ok(())
}

pub async fn list_devices(pool: &DatabasePool) -> Result<Vec<TrustedDevice>, OmbraError> {
    sqlx::query_as::<_, TrustedDevice>(
        "SELECT cn, label, first_seen, last_seen, revoked_at
         FROM trusted_devices
         ORDER BY last_seen DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("list trusted devices: {e}")))
}

pub async fn revoke_device(pool: &DatabasePool, cn: &str, now: i64) -> Result<bool, OmbraError> {
    let rows = sqlx::query(
        "UPDATE trusted_devices SET revoked_at = ? WHERE cn = ? AND revoked_at IS NULL",
    )
    .bind(now)
    .bind(cn)
    .execute(pool)
    .await
    .map_err(|e| OmbraError::Storage(format!("revoke device: {e}")))?;

    Ok(rows.rows_affected() > 0)
}

pub async fn delete_device(pool: &DatabasePool, cn: &str) -> Result<bool, OmbraError> {
    let rows = sqlx::query("DELETE FROM trusted_devices WHERE cn = ?")
        .bind(cn)
        .execute(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("delete trusted device: {e}")))?;

    Ok(rows.rows_affected() > 0)
}
