use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub trace_id: Uuid,
    pub timestamp_ns: u128,
    pub component: String,
    pub entropy_level: EntropyLevel,
    pub raw_payload: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EntropyLevel {
    Debug,
    Info,
    Warn,
    Error,
    Critical,
}

impl LogEntry {
    pub fn new(
        component: impl Into<String>,
        entropy_level: EntropyLevel,
        raw_payload: serde_json::Value,
    ) -> Self {
        Self {
            trace_id: Uuid::new_v4(),
            timestamp_ns: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos(),
            component: component.into(),
            entropy_level,
            raw_payload,
        }
    }
}
