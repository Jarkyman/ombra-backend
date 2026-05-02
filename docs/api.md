# API Reference

All endpoints require a valid mTLS client certificate. Requests without one are rejected at the TLS handshake — not with a 401.

```bash
# Base curl flags for all requests
CURL="curl --cert certs/client.crt --key certs/client.key --cacert certs/ca.crt"
```

---

## Health

### `GET /health`

Returns `ok` if the server is running.

---

## Transcripts

### WebSocket `GET /ws/transcript`

Receive transcript chunks from the mobile app in real time. Each message is a JSON object:

```json
{
  "session_id": "abc123",
  "text": "Vi mødes igen på fredag",
  "recorded_at": 1713456789
}
```

Technically empty transcripts (`[BLANK_AUDIO]`, whitespace-only) are silently discarded. Everything else is stored encrypted and added to the current open cluster for the session.

---

## Query

### `POST /query`

Ask a natural language question against your captured memory. Returns a concise, factual answer — no filler, no conclusions, just what was captured.

**Request**
```json
{ "text": "Hvad talte jeg med Lars om?" }
```

**Response**
```json
{
  "answer": "Lars nævnte at han ville skifte job. I mødet torsdag diskuterede I Q3-budgettet.",
  "sources": [
    {
      "cluster_id": "uuid",
      "event_type": "conversation",
      "event_summary": "Conversation with Lars about job change and Q3 budget.",
      "started_at": 1713456789
    }
  ]
}
```

The answer is always in the language configured in `response_language` (see Settings). The underlying memory may be in any language — the LLM handles cross-language retrieval automatically.

---

## Sessions

A session is a continuous recording period identified by a `session_id` sent from the mobile app.

### `GET /sessions`

List all sessions, ordered by most recent activity.

**Response**
```json
[
  {
    "session_id": "abc123",
    "first_seen": 1713456000,
    "last_seen": 1713459600,
    "transcript_count": 42,
    "cluster_count": 8
  }
]
```

### `GET /sessions/:session_id/clusters`

All clusters for a session, ordered chronologically.

---

## Clusters

A cluster is a 3–5 minute window of transcripts that have been scored and summarized by the LLM. This is the primary unit of memory.

### `GET /clusters`

Paginated list of all clusters, newest first.

**Query params**

| Param | Default | Max |
|---|---|---|
| `limit` | `20` | `100` |
| `offset` | `0` | — |

**Response**
```json
[
  {
    "id": "uuid",
    "session_id": "abc123",
    "started_at": 1713456000,
    "closed_at": 1713456300,
    "event_type": "meeting",
    "relevance_score": 0.87,
    "event_summary": "Team standup — discussed deployment blockers and sprint goals.",
    "language": "en"
  }
]
```

**Event types:** `conversation`, `meeting`, `travel`, `arrival`, `ambient`, `noise`

**Relevance score:** `0.0` = pure background noise, `1.0` = important personal event worth remembering

### `GET /clusters/:id`

Single cluster by ID. Returns `404` if not found.

---

## Settings

Only a safe subset of config is exposed. The encryption key and certificate paths are never visible or modifiable via the API.

### `GET /settings`

**Response**
```json
{
  "response_language": "da",
  "cluster_timeout_minutes": 5,
  "profile_encounter_threshold": 5
}
```

### `PATCH /settings`

Update one or more settings. Changes are persisted to `ombra.toml` immediately.

**Request** — all fields optional
```json
{
  "response_language": "en",
  "cluster_timeout_minutes": 3,
  "profile_encounter_threshold": 3
}
```

`response_language` takes effect immediately for all subsequent queries. `cluster_timeout_minutes` and `profile_encounter_threshold` take effect after a server restart.

**Language codes:** ISO 639-1 — `da`, `en`, `de`, `fr`, `es`, `it`, `pt`, `nl`, `sv`, `no`, etc.
