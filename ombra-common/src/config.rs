use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::encryption;
use crate::error::OmbraError;
use crate::hardware::HardwareProfile;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DdnsConfig {
    pub provider: DdnsProvider,
    pub token: String,
    pub subdomain: String,
}

impl DdnsConfig {
    pub fn public_hostname(&self) -> String {
        match self.provider {
            DdnsProvider::DuckDns => format!("{}.duckdns.org", self.subdomain),
            DdnsProvider::OmbraDns => format!("{}.ombra.io", self.subdomain),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DdnsProvider {
    DuckDns,
    OmbraDns,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub server_port: u16,
    pub database_path: PathBuf,
    pub qdrant_url: String,
    pub models_directory: PathBuf,
    pub response_language: String,
    pub hardware_profile: HardwareProfile,
    pub profile_encounter_threshold: u32,
    pub cluster_timeout_minutes: u64,
    pub tls_server_cert_path: PathBuf,
    pub tls_server_key_path: PathBuf,
    pub tls_client_ca_cert_path: PathBuf,
    pub encryption_key: String,
    pub ddns: Option<DdnsConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        let hardware_profile = HardwareProfile::detect();

        Self {
            server_port: 8080,
            database_path: PathBuf::from("ombra.db"),
            qdrant_url: "http://localhost:6334".to_string(),
            models_directory: PathBuf::from("models"),
            response_language: "en".to_string(),
            hardware_profile,
            profile_encounter_threshold: 5,
            cluster_timeout_minutes: 5,
            tls_server_cert_path: PathBuf::from("certs/server.crt"),
            tls_server_key_path: PathBuf::from("certs/server.key"),
            tls_client_ca_cert_path: PathBuf::from("certs/client-ca.crt"),
            encryption_key: encryption::generate_key(),
            ddns: None,
        }
    }
}

impl AppConfig {
    pub fn load(path: &Path) -> Result<Self, OmbraError> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| OmbraError::Storage(format!("read config: {e}")))?;

        toml::from_str(&content)
            .map_err(|e| OmbraError::Storage(format!("parse config: {e}")))
    }

    pub fn save(&self, path: &Path) -> Result<(), OmbraError> {
        let content = toml::to_string_pretty(self)
            .map_err(|e| OmbraError::Storage(format!("serialize config: {e}")))?;

        std::fs::write(path, content)
            .map_err(|e| OmbraError::Storage(format!("write config: {e}")))
    }

    pub fn model_path(&self) -> PathBuf {
        self.models_directory
            .join(self.hardware_profile.model_filename())
    }

    pub fn is_first_run(&self) -> bool {
        !self.database_path.exists()
    }

    pub fn encryption_key_bytes(&self) -> Result<[u8; 32], OmbraError> {
        encryption::parse_key(&self.encryption_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_survives_toml_roundtrip() {
        let original = AppConfig::default();
        let serialized = toml::to_string_pretty(&original).unwrap();
        let restored: AppConfig = toml::from_str(&serialized).unwrap();

        assert_eq!(restored.server_port, original.server_port);
        assert_eq!(restored.response_language, original.response_language);
        assert_eq!(restored.cluster_timeout_minutes, original.cluster_timeout_minutes);
        assert_eq!(restored.encryption_key, original.encryption_key);
    }

    #[test]
    fn default_encryption_key_is_parseable() {
        let config = AppConfig::default();
        assert!(config.encryption_key_bytes().is_ok());
    }

    #[test]
    fn default_response_language_is_set() {
        let config = AppConfig::default();
        assert!(!config.response_language.is_empty());
    }
}
