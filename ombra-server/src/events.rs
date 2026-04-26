use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum ServerEvent {
    ClusterReady {
        session_id: String,
        cluster_id: String,
    },
}
