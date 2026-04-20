pub mod cluster;
pub mod entity;
pub mod session;
pub mod transcript;
pub mod user_profile;

#[cfg(test)]
pub(crate) async fn create_test_db() -> DatabasePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("failed to create in-memory SQLite pool");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("failed to run migrations on test database");

    pool
}

use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

use ombra_common::error::OmbraError;

pub type DatabasePool = SqlitePool;

pub async fn create_pool(database_url: &str) -> Result<DatabasePool, OmbraError> {
    SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await
        .map_err(|e| OmbraError::Storage(format!("database connection: {e}")))
}

pub async fn run_migrations(pool: &DatabasePool) -> Result<(), OmbraError> {
    sqlx::migrate!("./migrations")
        .run(pool)
        .await
        .map_err(|e| OmbraError::Storage(format!("migration: {e}")))
}
