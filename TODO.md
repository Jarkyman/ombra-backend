# TODO

## ombra-common

- [x] Add `HardwareProfile` enum (Performance / Efficiency / Edge) with auto-detection logic
- [x] Add shared `AppConfig` struct (server port, database path, Qdrant URL, model path)
- [x] Add `response_language` field to `AppConfig` (ISO 639-1, e.g. "da", "en") — configured at setup, changeable later

## ombra-server

- [x] Set up SQLx with SQLite — migrations folder + initial schema (transcripts, sessions)
- [x] Add AES-256-GCM encryption layer for SQLite at rest (field-level on transcript content)
- [x] Implement mTLS with `rustls` — client certificate validation for iPhone + hardware device
- [ ] (S) [BACKEND, Infrastructure]: Let's Encrypt cert via DNS-01 challenge — proves domain ownership via DNS TXT record, no open ports required. Works with both DuckDNS and a custom domain. Replaces self-signed dev certs for production.
- [x] WebSocket endpoint for receiving transcripts from the mobile app
- [x] Transcript ingestion — only discard technically empty transcripts ([BLANK_AUDIO], whitespace-only); store everything else
- [x] Add `detected_language` (ISO 639-1) and `raw_whisper_text` fields to transcripts table (migration)
- [x] REST endpoints for the mobile app (sessions, clusters, settings GET/PATCH)
- [x] `GET /sessions/:id/transcripts` — list raw transcripts in a session so the app/debug tools can verify ingestion before clusters are ready
- [x] Processing status + app callback — when a cluster finishes AI processing, push a WebSocket event to connected clients (`{"event": "cluster_ready", "session_id": "...", "cluster_id": "..."}`) so the app can refresh without polling
- [x] Wire up `tower-http` tracing middleware with JSONL log format
- [x] (S) [BACKEND]: Close open clusters on WebSocket disconnect — `flush_session()` on `IngestionPipeline`; WebSocket handler tracks active session IDs and flushes on disconnect
- [x] (S) [BACKEND, Infrastructure]: Qdrant startup retry — `connect_qdrant_with_retry()` in main.rs; 8 attempts × 3s backoff before panic
- [x] (S) [BACKEND, AI]: Cluster processing fallback — if LLM returns garbled JSON, falls back to `event_type="unclassified"`, `relevance_score=0.5`, `event_summary` = truncated raw text
- [x] (S) [BACKEND]: `GET /entities` and `GET /entities/:id` — `handlers/entities.rs`, wired in router
- [x] (S) [Security, BACKEND]: `config.save()` file permissions — `write_private_file()` uses `OpenOptions::mode(0o600)` on Unix
- [ ] (C) [AI, BACKEND]: score_cluster + extract_entities in parallel — both are independent LLM calls on the same data; run with `tokio::join!` for ~2x faster cluster processing
- [ ] (C) [BACKEND, AI]: Query response streaming — stream LLM tokens via SSE instead of buffering the full response; eliminates first-token latency for the user

## ombra-ai

- [x] Implement `InferenceEngine` trait with `llama-cpp-2` bindings (greedy decoding)
- [x] (S) [AI]: Sampler chain — `penalties(1.1) → temp → top_p(0.9) → dist`. Two modes: `complete` (temp 0.35, natural language) and `complete_structured` (temp 0.1, JSON tasks). Thread count now correctly passed to `LlamaContextParams` via `with_n_threads` — was defaulting to 4 regardless of hardware.
- [x] Add hardware-aware model loader — detects arch + RAM and selects correct GGUF quantization
- [x] Implement `EmbeddingEngine` trait with `fastembed` (nomic-embed-text-v1.5)
- [x] Complete `VectorStore` — connect to Qdrant, upsert embeddings, semantic search
- [x] Language detection at ingestion — `whichlang` (pure Rust, algorithmic) tags each cluster with ISO 639-1 code before embedding
- [x] RAG pipeline — embed query → retrieve context from Qdrant → prompt LLM → concise factual answer
- [x] Cross-language query handling — LLM always responds in the language configured in `AppConfig.response_language`
- [x] System prompt template includes response language instruction so it applies to every single LLM call globally

## Ingestion Pipeline (process eagerly on arrival, not deferred)

Design decision: do as much as possible the moment a transcript arrives.
Idle time is for retrospective work on old data — not for catching up on current data.
When a cluster closes, it should already be fully processed, embedded, and queryable.

Ingestion flow per transcript chunk:

1. Discard if technically empty ([BLANK_AUDIO], whitespace-only)
2. Detect language (ISO 639-1)
3. Append to current open cluster (3-5 min time window)

When a cluster closes (time window expires or session ends): 4. AI scores cluster → event_type + relevance_score (0.0–1.0) 5. AI generates event_summary (this is what gets embedded, not raw lines) 6. AI extracts named entities from the cluster 7. Store cluster + summary + score in SQLite 8. Embed event_summary → Qdrant with language + event_type metadata 9. Upsert extracted entities → increment encounter_count, update last_seen 10. If any entity crosses profile threshold → generate profile summary + embed immediately

- [x] Design and implement the full ingestion pipeline as a single async pipeline in `ombra-server`
- [x] Add `clusters` table to schema — id, started_at, closed_at, event_type, relevance_score, event_summary, language
- [x] Add `cluster_id` FK to transcripts table (migration)
- [x] Cluster window management — track open cluster per session, auto-close on timeout
- [ ] (S) [BACKEND, AI]: Add `trash_candidates` table — AI writes low-relevance clusters here with reason, user confirms deletion

## Knowledge Graph — Brain-Like Memory (future)

Design decision: model the system after how human memory works.

- Short-term memory = raw transcript clusters (last 24-48h, unprocessed)
- Long-term memory = embedded event summaries + entity profiles in Qdrant
- Working memory = context window during an LLM call
- Sleep / idle time = when the AI consolidates, builds profiles, scores relevance

Entities are people, places, projects, and topics that appear repeatedly.
A stranger on the bus does not get a profile. Someone who appears 5+ times does.
Context (work / family / friends / project) is inferred from when and where encounters happen
— not manually tagged by the user.

### Entity Schema (SQLite)

- [x] `entities` table — id, name, entity_type (person / place / project / topic), first_seen, last_seen, encounter_count
- [x] `entity_context_tags` table — entity_id, tag (work / family / friends / project / other)
- [x] `entity_mentions` table — links entity_id to a transcript cluster_id
- [x] `entity_relationships` table — entity_id, related_entity_id, relationship_type, strength (float)

### Entity Profile Building

- [x] AI extracts named entities from each scored cluster at ingestion time
- [x] If entity already exists: increment encounter_count, update last_seen, strengthen relationships
- [x] If entity is new: create with encounter_count = 1, no profile yet
- [x] Profile generation threshold — when encounter_count crosses a configurable minimum (default: 5), AI generates a full profile summary and embeds it in Qdrant
- [ ] (C) [AI, BACKEND]: Profiles re-generated during idle time as new encounters accumulate

### Context Inference

- [ ] (C) [AI, BACKEND]: Work context inferred from: recurring people + daytime hours + project/task language
- [ ] (C) [AI, BACKEND]: Family context inferred from: home location + recurring names + recurring environment
- [ ] (C) [AI, BACKEND]: Friends context inferred from: social patterns, leisure hours, recurring names outside work
- [ ] (C) [AI, BACKEND]: AI assigns and revises context tags automatically — user can correct via app

### Query Enrichment

- [x] When answering a query, retrieve both relevant event summaries AND relevant entity profiles as context
- [x] Entity profiles make answers richer: "hvad talte jeg med Lars om sidst?" pulls Lars's profile + recent clusters mentioning Lars

## Idle-Time Work (retrospective only — current data is already fully processed at ingestion)

- [ ] (C) [AI, BACKEND]: Re-score old clusters as entity profiles mature — a cluster scored as "ambient" early on may gain relevance once the entities in it are better understood
- [ ] (C) [AI, BACKEND]: Deepen entity relationship graph — recalculate relationship strengths across accumulated history
- [ ] (S) [AI, BACKEND]: Write low-relevance clusters to `trash_candidates` with AI-generated reason
- [ ] (S) [UI, BACKEND]: User-facing "review trash" prompt — surface candidates in mobile or TUI, user confirms deletion
- [ ] (M) [BACKEND]: Never auto-delete — always require explicit user confirmation

## ombra-cli

- [ ] (C) [CLI, UI]: Implement Ratatui dashboard — real-time CPU/RAM/NPU telemetry
- [ ] (C) [CLI, UI]: Add JSONL log stream panel to dashboard
- [ ] (C) [CLI, UI]: Add model deployment status panel to dashboard
- [ ] (S) [CLI]: `ombra status` — print: server health (`/health`), loaded model name, Qdrant reachability, systemd service state, last cluster processed timestamp, cluster queue depth
- [x] (M) [CLI, Infrastructure]: Add `Install` command — ratatui TUI wizard: model selection, language, remote access, certs, background Qdrant + model download + server build, onboarding questionnaire, systemd service install

## User Onboarding & Personalization

Design decision: when the backend is set up for the first time, the AI conducts a short
onboarding interview via the CLI. Answers are stored as a structured user profile that the
AI uses as permanent context on every query. The profile evolves automatically over time
as the AI learns more — but it needs a foundation to start from.

### Setup Onboarding (first-time only)

- [x] `setup.sh` runs onboarding questionnaire while background jobs (download + build) run in parallel. Answers written to `user_profile.toml`. User can skip any question or type 'done' to jump to progress bar.
- [x] Server reads `user_profile.toml` on first boot → inserts into `user_profile` SQLite table (`onboarding.rs`)
- [x] AI generates a free-text profile summary from the answers → stored in SQLite + injected as "About the user:" section in every RAG prompt
- [x] Profile is never overwritten by onboarding again — `run_if_needed()` skips if DB row already exists
- [ ] (S) [AI, BACKEND]: Embed user profile summary in Qdrant (currently only in AppState/prompt — not searchable as a vector)
- [ ] (C) [AI, UI]: When user is filling all the questions and the AI is downloaded, feed the information to it and ask it to generate questions it need to know the person better.

### Ongoing Personalization (future)

- [ ] (C) [AI]: AI proactively asks clarifying questions during idle time when it has identified gaps in its understanding of the user ("I keep hearing about 'projektet' — what is that?")
- [ ] (C) [AI, UI]: Questions are queued and surfaced to the user in the mobile app or TUI, not asked mid-conversation
- [ ] (C) [AI, UI]: User can answer, skip, or dismiss — all responses update the profile

## Infrastructure

- [x] `docker-compose.yml` — Qdrant sidecar
- [x] `install.sh` — `curl | bash` bootstrap: OS check (Ubuntu), apt deps, Docker (official repo), Rust via rustup, git clone to `~/ombra`, builds `ombra-cli`, execs `ombra install`
- [x] `ombra install` — ratatui TUI setup wizard (see ombra-cli section above)
- [x] `setup.sh` — legacy wizard (superseded by `install.sh` + `ombra install`)
- [x] Model download logic — detect hardware profile and pull correct GGUF file, user can override
- [x] Config and user profile written with `0o600` permissions (no world-readable window)
- [x] `install.sh` repo URL — points to `https://github.com/Jarkyman/ombra-backend`
- [ ] (C) [Infrastructure]: Register `get.ombra.io` and set up redirect to raw GitHub install.sh — so the install command becomes `curl -sSf https://get.ombra.io | bash`
- [x] `generate_dev_certs.sh` auto-detects server LAN IP and includes it in cert SAN — mobile app can connect over local network
- [x] UPnP automatic port mapping — `network/upnp.rs`, uses `igd` crate, detects local IP via UDP socket trick, logs warning if router doesn't support UPnP (server still works locally)
- [x] DDNS — `network/ddns.rs` + `network/mod.rs`. DuckDNS update loop every 5 min. `DnsUpdater` trait abstraction for future `OmbraDns`. `AppConfig` fields: `ddns: Option<DdnsConfig>` with `provider`, `token`, `subdomain`.
- [x] DuckDNS is optional — user answers N to "Set up remote access?" and server runs locally only via `ombra.local` and LAN IP
- [x] mDNS hostname (`ombra.local`) — avahi-daemon installed by setup.sh, cert SAN includes `DNS:ombra.local`, app tries local first and falls back to DDNS hostname
- [ ] (S) [CLI, Infrastructure]: `ombra upgrade` command — `git pull && cargo build --release`, then `sudo systemctl restart ombra` (or print manual instructions on WSL2)
- [ ] (S) [CLI]: `ombra status` — show: server reachability, loaded model name, Qdrant status, cluster queue depth, systemd service state, last cluster processed timestamp
- [ ] (W) [Infrastructure]: Ombra Relay (future, required for 100% of users) — a minimal relay server hosted under `ombra.io` that handles connection routing only, not data. Data flows directly between app and user's box once the connection is established — the relay only brokers the handshake. One small server can handle thousands of users. Necessary for users behind CGNAT (mobile internet, some cable providers) where UPnP and port forwarding are physically impossible. This is a deliberate infrastructure investment to make when the product goes to market.
- [ ] (S) [BACKEND, Security]: Trusted Devices — track which client certificates have connected (by cert CN, stored in SQLite). Expose an API to list and revoke devices. App and CLI can show the list and let the user kick a device off. Currently mTLS ensures only cert-holders can connect, but there is no management UI.
- [ ] (C) [BACKEND, UI]: In-app QR code generation — authenticated endpoint on the mTLS server (`POST /provision/rotate`) that writes a new token to `provision_token` and returns the full QR payload (`host`, `port`, `provision_port`, `token`, `ca_fp`). The app renders the QR inline so the user can scan it from a second device without touching the server terminal. Flow: app → POST /provision/rotate (mTLS) → server updates token file → returns payload → app renders QR → second device scans → fetches certs from provision server.

## Testing

### Unit Tests (per crate, run with `cargo test`)

- [x] `ombra-common` — encryption: roundtrip, wrong key, empty input, unicode, nonce uniqueness, key parsing
- [x] `ombra-common` — hardware: profile detection, model_filename, huggingface_repo format
- [x] `ombra-common` — config: TOML roundtrip, encryption key parseable
- [x] `ombra-server` — ingestion: `is_empty_transcript` rejects all known empty tags + whitespace, accepts real content
- [x] `ombra-server` — cluster: add transcripts, accumulate in session, separate sessions, drain on timeout=0, close by session

### Integration Tests (real SQLite, no mocks)

- [x] DB: insert transcript with encryption, read back and verify decrypted content matches original
- [x] DB: raw DB row does not contain plaintext (encryption verified at storage layer)
- [x] DB: wrong key returns error on read
- [x] DB: list transcripts by session returns chronological order
- [x] DB: list by session excludes other sessions
- [x] DB: insert cluster, retrieve by id, list newest-first, pagination, filter by session
- [x] DB: migration runs cleanly on a fresh in-memory database (implicit in all DB tests)
- [ ] (C) [Testing, BACKEND]: Ingestion pipeline: end-to-end — WebSocket message → stored in DB → cluster updated

### Security Tests

- [ ] (C) [Testing, Security]: mTLS: request with valid client cert → 200 OK
- [ ] (C) [Testing, Security]: mTLS: request without client cert → TLS handshake failure (connection refused, not 401)
- [ ] (C) [Testing, Security]: mTLS: request with a cert signed by a different CA → TLS handshake failure
- [ ] (C) [Testing, Security]: Encryption: verify that raw SQLite file contains no plaintext transcript content

### Flow Tests (full system running)

- [ ] (S) [Testing, Infrastructure]: Setup flow: run `generate_dev_certs.sh` → start server → health check passes
- [ ] (C) [Testing, BACKEND]: Transcript flow: send chunk via WebSocket → appears in DB encrypted → readable via query
- [ ] (S) [Testing, BACKEND]: Empty filter: send [BLANK_AUDIO] → nothing written to DB
- [ ] (S) [Testing, BACKEND]: Cluster flow: send multiple chunks → cluster groups them → cluster closes after timeout

### VM-Based Hardware Profile Testing

Note: use UTM (free, macOS) to spin up VMs with specific RAM allocations to test each profile.
UTM uses QEMU under the hood and supports both x86_64 and ARM64 guests.

- [ ] (C) [Testing, Infrastructure]: Set up UTM on macOS with an Ubuntu 24.04 x86_64 VM, 32GB RAM allocation → verify Performance profile detected
- [ ] (C) [Testing, Infrastructure]: Set up UTM with 8GB RAM allocation → verify Efficiency profile detected
- [ ] (C) [Testing, Infrastructure]: Set up UTM with ARM64 guest → verify Edge profile detected
- [ ] (C) [Testing, Infrastructure]: Run full setup flow inside VM: certs, config, server start, health check
- [ ] (C) [Testing, Infrastructure]: Verify correct GGUF model filename is selected per profile without downloading the actual model

## UTM / Hardware Test Findings

Issues and improvements found during real-hardware and VM testing.

- [ ] (S) [UI, BACKEND]: Model selection only shows models the hardware can actually run — filter out profiles that require more RAM than detected. Currently all three options always show.
- [ ] (C) [UI, BACKEND]: Advanced mode allows manual model selection (any GGUF repo + filename) for power users who want to override the auto-detected profile.
- [ ] (S) [UI, BACKEND]: Onboarding questionnaire needs more questions — cover daily routines, hobbies, relationships, goals, communication style etc. to give the AI a richer starting context.
- [ ] (C) [CLI, BACKEND]: Add `setup.sh --profile` flag to re-enter the onboarding questionnaire at any time after setup, so the user can add or update answers without re-running the full wizard.

## Backend Code Review Action Items

### Security & Vulnerabilities

- [x] (M) [Security, BACKEND]: `setup.sh` file permissions race condition — Run `umask 077` before creating the config file.
- [ ] (S) [Security, BACKEND]: `setup.sh` model validation — Add SHA256/MD5 validation to prevent loading corrupted or tampered GGUF files.
- [ ] (S) [Security, Docs]: `ombra.toml` security — Document plaintext SQLite encryption key risk.

### Performance & Optimization

- [x] (M) [Optimization, BACKEND]: Fix N+1 query (`get_clusters_by_ids`) — Use `sqlx::QueryBuilder` in `ombra-server/src/db/cluster.rs`.
- [x] (M) [Optimization, BACKEND]: Fix N+1 query (`assign_transcripts_to_cluster`) — Rewrite to batch update in `ombra-server/src/db/cluster.rs`.
- [x] (M) [Optimization, BACKEND]: Missing SQLite Transactions — Wrap cluster saving in `pool.begin().await`.

### Robustness & Error Handling

- [ ] (S) [BACKEND, Infrastructure]: `setup.sh` dependency check — Check `/etc/os-release` first.
- [x] (M) [Security, BACKEND]: API Error messages — Ensure `ombra_common::error::OmbraError` does not leak raw database errors.

### Architecture & Code Quality

- [x] (M) [BACKEND]: Stale open clusters on restart — Run a sweep on server startup to close outdated open clusters.

## Pre-production cleanup

- [x] (M) [Formatting, BACKEND]: Fix `dead_code` warnings in `entity.rs` (first_seen, last_seen), `transcript.rs` (session_id, raw_whisper_text, detected_language, recorded_at, created_at), and `user_profile.rs` (id, created_at) — either use the fields or remove them. Run `cargo clippy -- -D warnings` with zero warnings before shipping.

## future

- [ ] (W) [UI, AI]: Assistant mode (can do stuff for me)
- [ ] (W) [UI]: Notifications (Remind me of stuff I need to do)
- [ ] (W) [AI]: Picture analysis, for computer and phone
- [ ] (W) [BACKEND]: How much access can I get to mobile data? (battery drain)
- [ ] (W) [UI, AI]: 'Hey Ombra' Function, to ask questions (needs Notifications first)
- [ ] (C) [AI, BACKEND]: Fuzzy entity matching — before creating a new entity, check if a close variant already exists ("Lars" vs "Lars Hansen"); use string similarity + LLM confirmation if ambiguous
- [ ] (M) [UI, BACKEND]: Admin panel — web UI served by the backend, accessible at `ombra.local` or LAN IP (local network only). Shows: live logs, clusters, entity graph, system health, threshold config. Like a router admin page but for your second brain.
