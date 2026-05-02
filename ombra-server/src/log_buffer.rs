use std::collections::VecDeque;
use std::sync::{Arc, Mutex, atomic::{AtomicU64, Ordering}};

use serde::Serialize;
use tokio::sync::broadcast;
use tracing::Subscriber;
use tracing_subscriber::Layer;

const MAX_ENTRIES: usize = 500;
const BROADCAST_CAPACITY: usize = 256;

#[derive(Serialize, Clone)]
pub struct LogEntry {
    pub id: u64,
    pub level: String,
    pub component: String,
    pub message: String,
    pub timestamp_ms: u64,
    pub payload: serde_json::Value,
}

#[derive(Clone)]
pub struct LogBuffer(Arc<Inner>);

struct Inner {
    entries: Mutex<VecDeque<LogEntry>>,
    counter: AtomicU64,
    broadcast: broadcast::Sender<LogEntry>,
}

impl LogBuffer {
    pub fn new() -> Self {
        let (broadcast, _) = broadcast::channel(BROADCAST_CAPACITY);
        Self(Arc::new(Inner {
            entries: Mutex::new(VecDeque::with_capacity(MAX_ENTRIES)),
            counter: AtomicU64::new(0),
            broadcast,
        }))
    }

    pub fn recent(&self, limit: usize) -> Vec<LogEntry> {
        let entries = self.0.entries.lock().unwrap();
        let collected: Vec<LogEntry> = entries.iter().cloned().collect();
        let len = collected.len();
        let start = len.saturating_sub(limit);
        collected[start..].to_vec()
    }

    pub fn subscribe(&self) -> broadcast::Receiver<LogEntry> {
        self.0.broadcast.subscribe()
    }
}

pub struct LogBufferLayer {
    buffer: LogBuffer,
}

impl LogBufferLayer {
    pub fn new(buffer: LogBuffer) -> Self {
        Self { buffer }
    }
}

struct FieldVisitor {
    message: String,
    payload: serde_json::Map<String, serde_json::Value>,
}

impl FieldVisitor {
    fn new() -> Self {
        Self {
            message: String::new(),
            payload: serde_json::Map::new(),
        }
    }
}

impl tracing::field::Visit for FieldVisitor {
    fn record_str(&mut self, field: &tracing::field::Field, value: &str) {
        if field.name() == "message" {
            self.message = value.to_string();
        } else {
            self.payload.insert(
                field.name().to_string(),
                serde_json::Value::String(value.to_string()),
            );
        }
    }

    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        let s = format!("{value:?}");
        if field.name() == "message" {
            self.message = s;
        } else {
            self.payload
                .insert(field.name().to_string(), serde_json::Value::String(s));
        }
    }

    fn record_i64(&mut self, field: &tracing::field::Field, value: i64) {
        self.payload
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_u64(&mut self, field: &tracing::field::Field, value: u64) {
        self.payload
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_f64(&mut self, field: &tracing::field::Field, value: f64) {
        self.payload
            .insert(field.name().to_string(), serde_json::json!(value));
    }

    fn record_bool(&mut self, field: &tracing::field::Field, value: bool) {
        self.payload
            .insert(field.name().to_string(), serde_json::json!(value));
    }
}

impl<S: Subscriber> Layer<S> for LogBufferLayer {
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        let meta = event.metadata();

        let level = meta.level().to_string();
        let component = meta
            .target()
            .rsplit("::")
            .next()
            .unwrap_or(meta.target())
            .to_string();

        let mut visitor = FieldVisitor::new();
        event.record(&mut visitor);

        let timestamp_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        let id = self.buffer.0.counter.fetch_add(1, Ordering::Relaxed);

        let entry = LogEntry {
            id,
            level,
            component,
            message: visitor.message,
            timestamp_ms,
            payload: serde_json::Value::Object(visitor.payload),
        };

        let mut entries = self.buffer.0.entries.lock().unwrap();
        if entries.len() >= MAX_ENTRIES {
            entries.pop_front();
        }
        entries.push_back(entry.clone());
        let _ = self.buffer.0.broadcast.send(entry);
    }
}
