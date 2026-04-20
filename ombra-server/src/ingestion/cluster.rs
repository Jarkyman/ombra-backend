use std::collections::HashMap;
use std::time::Instant;

use uuid::Uuid;

pub struct ClusterManager {
    open_clusters: HashMap<String, OpenCluster>,
    timeout_minutes: u64,
}

pub struct OpenCluster {
    pub cluster_id: String,
    pub session_id: String,
    pub started_at: i64,
    pub transcript_ids: Vec<String>,
    pub last_activity: Instant,
}

impl ClusterManager {
    pub fn new(timeout_minutes: u64) -> Self {
        Self {
            open_clusters: HashMap::new(),
            timeout_minutes,
        }
    }

    pub fn add_transcript(&mut self, session_id: &str, transcript_id: &str) -> &OpenCluster {
        let cluster = self
            .open_clusters
            .entry(session_id.to_owned())
            .or_insert_with(|| OpenCluster {
                cluster_id: Uuid::new_v4().to_string(),
                session_id: session_id.to_owned(),
                started_at: current_unix_timestamp(),
                transcript_ids: Vec::new(),
                last_activity: Instant::now(),
            });

        cluster.transcript_ids.push(transcript_id.to_owned());
        cluster.last_activity = Instant::now();
        cluster
    }

    pub fn drain_expired_clusters(&mut self) -> Vec<OpenCluster> {
        let timeout = std::time::Duration::from_secs(self.timeout_minutes * 60);
        let expired_keys: Vec<String> = self
            .open_clusters
            .iter()
            .filter(|(_, cluster)| cluster.last_activity.elapsed() >= timeout)
            .map(|(key, _)| key.clone())
            .collect();

        expired_keys
            .into_iter()
            .filter_map(|key| self.open_clusters.remove(&key))
            .collect()
    }

    #[allow(dead_code)]
    pub fn close_cluster(&mut self, session_id: &str) -> Option<OpenCluster> {
        self.open_clusters.remove(session_id)
    }
}

fn current_unix_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_transcript_creates_a_new_cluster() {
        let mut manager = ClusterManager::new(5);
        let cluster = manager.add_transcript("session-a", "transcript-1");

        assert_eq!(cluster.session_id, "session-a");
        assert_eq!(cluster.transcript_ids, vec!["transcript-1"]);
    }

    #[test]
    fn same_session_accumulates_transcripts_in_one_cluster() {
        let mut manager = ClusterManager::new(5);
        manager.add_transcript("session-a", "transcript-1");
        manager.add_transcript("session-a", "transcript-2");
        manager.add_transcript("session-a", "transcript-3");

        let cluster = manager.close_cluster("session-a").unwrap();
        assert_eq!(cluster.transcript_ids.len(), 3);
    }

    #[test]
    fn different_sessions_get_separate_clusters() {
        let mut manager = ClusterManager::new(5);
        manager.add_transcript("session-a", "transcript-1");
        manager.add_transcript("session-b", "transcript-2");

        let cluster_a = manager.close_cluster("session-a").unwrap();
        let cluster_b = manager.close_cluster("session-b").unwrap();

        assert_ne!(cluster_a.cluster_id, cluster_b.cluster_id);
        assert_eq!(cluster_a.transcript_ids, vec!["transcript-1"]);
        assert_eq!(cluster_b.transcript_ids, vec!["transcript-2"]);
    }

    #[test]
    fn drain_returns_nothing_before_timeout() {
        let mut manager = ClusterManager::new(5);
        manager.add_transcript("session-a", "transcript-1");

        let expired = manager.drain_expired_clusters();
        assert!(expired.is_empty());
    }

    #[test]
    fn drain_returns_cluster_when_timeout_is_zero() {
        let mut manager = ClusterManager::new(0);
        manager.add_transcript("session-a", "transcript-1");

        let expired = manager.drain_expired_clusters();
        assert_eq!(expired.len(), 1);
        assert_eq!(expired[0].session_id, "session-a");
    }

    #[test]
    fn drain_removes_cluster_from_active_set() {
        let mut manager = ClusterManager::new(0);
        manager.add_transcript("session-a", "transcript-1");
        manager.drain_expired_clusters();

        assert!(manager.close_cluster("session-a").is_none());
    }

    #[test]
    fn close_cluster_returns_and_removes_it() {
        let mut manager = ClusterManager::new(5);
        manager.add_transcript("session-a", "transcript-1");

        let cluster = manager.close_cluster("session-a");
        assert!(cluster.is_some());
        assert!(manager.close_cluster("session-a").is_none());
    }

    #[test]
    fn close_cluster_on_unknown_session_returns_none() {
        let mut manager = ClusterManager::new(5);
        assert!(manager.close_cluster("nonexistent").is_none());
    }
}
