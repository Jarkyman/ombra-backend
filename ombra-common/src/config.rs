use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::encryption;
use crate::error::OmbraError;
use crate::hardware::HardwareProfile;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoteAccessMode {
    #[default]
    LocalOnly,
    DuckDns,
    Tailscale,
    ZeroTier,
    CloudflareTunnel,
    RemoteIt,
    Ngrok,
    Packetriot,
    OmbraDns,
}

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
    #[serde(default = "default_client_cert_path")]
    pub tls_client_cert_path: PathBuf,
    #[serde(default = "default_client_key_path")]
    pub tls_client_key_path: PathBuf,
    #[serde(default = "default_provision_port")]
    pub provision_port: u16,
    pub encryption_key: String,
    pub ddns: Option<DdnsConfig>,
    #[serde(default = "default_admin_dir")]
    pub admin_dir: PathBuf,
    #[serde(default = "default_ca_key_path")]
    pub tls_ca_key_path: PathBuf,
    #[serde(default)]
    pub remote_access_mode: RemoteAccessMode,
    #[serde(default = "default_le_server_cert_path")]
    pub le_server_cert_path: PathBuf,
    #[serde(default = "default_le_server_key_path")]
    pub le_server_key_path: PathBuf,
    #[serde(default = "default_le_account_key_path")]
    pub le_account_key_path: PathBuf,
}

fn default_client_cert_path() -> PathBuf { PathBuf::from("certs/client.crt") }
fn default_client_key_path() -> PathBuf { PathBuf::from("certs/client.key") }
fn default_provision_port() -> u16 { 8081 }
fn default_admin_dir() -> PathBuf { PathBuf::from("admin") }
fn default_ca_key_path() -> PathBuf { PathBuf::from("certs/ca.key") }
fn default_le_server_cert_path() -> PathBuf { PathBuf::from("certs/le-server.crt") }
fn default_le_server_key_path() -> PathBuf { PathBuf::from("certs/le-server.key") }
fn default_le_account_key_path() -> PathBuf { PathBuf::from("certs/le-account.json") }

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
            tls_client_cert_path: default_client_cert_path(),
            tls_client_key_path: default_client_key_path(),
            provision_port: default_provision_port(),
            encryption_key: encryption::generate_key(),
            ddns: None,
            admin_dir: default_admin_dir(),
            tls_ca_key_path: default_ca_key_path(),
            remote_access_mode: RemoteAccessMode::default(),
            le_server_cert_path: default_le_server_cert_path(),
            le_server_key_path: default_le_server_key_path(),
            le_account_key_path: default_le_account_key_path(),
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

        write_private_file(path, &content)
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

fn write_private_file(path: &Path, content: &str) -> Result<(), OmbraError> {
    #[cfg(unix)]
    {
        use std::io::Write;
        use std::os::unix::fs::OpenOptionsExt;
        std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
            .and_then(|mut f| f.write_all(content.as_bytes()))
            .map_err(|e| OmbraError::Storage(format!("write config: {e}")))
    }
    #[cfg(not(unix))]
    {
        std::fs::write(path, content)
            .map_err(|e| OmbraError::Storage(format!("write config: {e}")))
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
