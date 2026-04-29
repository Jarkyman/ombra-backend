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
- [x] Entity profiles make answers richer: "what did I talk to Lars about last time?" pulls Lars's profile + recent clusters mentioning Lars

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

### Certificate Auto-Renewal

Design decision: once a device is connected, it should stay connected forever without manual intervention.
Client certs are valid for 1 year. The server detects approaching expiry and proactively issues a new cert
while the old one is still valid — the app rotates silently. The user never thinks about certificates.

- [ ] (M) [BACKEND, Security]: Certificate expiry monitor — on server startup and once daily, read expiry dates from all client cert files on disk. Store in SQLite (`cert_expiry` table: device CN, expiry timestamp, last_renewed). Log a warning when any cert is within 60 days of expiry.
- [ ] (M) [BACKEND, Security]: Auto-renewal endpoint `GET /provision/renew-cert` — authenticated via mTLS (so only a currently valid cert can trigger its own renewal). Server generates a new client cert signed by the CA, valid for another year, and returns it as a JSON payload (`{ cert_pem, key_pem, ca_pem }`). Old cert stays valid until it expires — no hard cutover.
- [ ] (M) [MOBILE, Security]: App checks cert expiry on launch and after each successful connection. If the active cert expires within 30 days, silently calls `GET /provision/renew-cert`, replaces the stored cert+key on device, and continues without interrupting the user.
- [ ] (S) [BACKEND, Security]: Server cert expiry monitor — if using a self-signed server cert, track its expiry the same way. If using Let's Encrypt, verify that the certbot renewal timer is active and log its next-run timestamp.
- [ ] (S) [CLI, Security]: `ombra renew-certs` command — manually triggers re-generation of all client certs and prints instructions for re-provisioning any device that cannot auto-renew (e.g., hardware device). Useful as a fallback if auto-renewal somehow fails.
- [ ] (S) [BACKEND, Security]: Renewed cert is written to disk atomically — generate to a temp file, then `rename()` into place. Avoids a window where the cert file is incomplete if the server crashes mid-write.
- [ ] (S) [BACKEND, Security]: Grace period overlap — when a renewed cert is issued, the server accepts both the old and the new cert until the old one expires. Prevents a race where the app has the new cert but the server hasn't persisted it yet.

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

## Admin Panel (Web UI)

Web UI served by `ombra-server`, accessible at `ombra.local/admin` or `<LAN-IP>/admin`. Local network only — never exposed through the DDNS/public endpoint. Matches the Ombra app design language: warm palette, luxury minimalism, dark mode default. Same color tokens, typography, and component style as the app (see `docs/design/app-design-v2.md`).

**Tech stack:** Vanilla HTML/CSS/JS served as static files from `ombra-server/admin/`. No build step — files committed directly to the repo. Axum `ServeDir` on the `/admin` route. CSS custom properties for all design tokens.

### Foundation

- [ ] (S) [BACKEND, UI]: Serve static files from `ombra-server/admin/` — Axum `ServeDir` on the `/admin` route. Files committed to repo, no build step.
- [ ] (S) [BACKEND, Security]: Admin routes protected by mTLS (same as all other routes) — no additional auth needed.
- [ ] (S) [BACKEND, Security]: Admin routes only accessible from loopback/LAN interfaces — middleware rejects requests from public IP ranges.
- [ ] (S) [UI]: CSS design tokens file — all colors from app-design-v2.md as CSS custom properties, dark mode default with `prefers-color-scheme` support and manual toggle.
- [ ] (S) [UI]: Base layout — left sidebar nav (collapsible), main content area, top header bar. Ombra enso logo at the top of the sidebar.
- [ ] (S) [UI]: Navigation sidebar items — Dashboard, Logs, Memory, Entities, Hardware, Analytics, (divider), Config, Devices, Profile, Trash, Plugins.
- [ ] (S) [UI]: Page header pattern — Cormorant Garamond italic 26sp title, DM Sans 14sp subtitle, action buttons on the right.
- [ ] (S) [UI]: Toast notifications — slide in from bottom-right, auto-dismiss 3s. Used for: config saved, device revoked, cluster deleted.
- [ ] (S) [UI]: Consistent card components — border-radius 18dp, surface background, Level 1 shadow, 1px border. Same as Memory Cluster Card in the app.
- [ ] (S) [UI, BACKEND]: Sidebar update badge — shows current server version in JetBrains Mono at the bottom. Pulsing warning-color badge labeled "Update" when a newer release is available on GitHub. Collapses to a pulsing dot when sidebar is collapsed. Clicking triggers `ombra upgrade`.

### Dashboard

At-a-glance system status — like a router admin homepage but for your second brain.

- [ ] (S) [UI, BACKEND]: `GET /admin/health` — server uptime, loaded model name, Qdrant status, SQLite DB size, systemd service state.
- [ ] (S) [UI]: Connect app QR panel — top-left card showing a QR code for provisioning new devices. "Regenerate" button calls `POST /provision/rotate` to issue a fresh token and update the QR payload. Same QR provisioning flow as described in the Infrastructure section.
- [ ] (S) [UI, BACKEND]: 2×2 stat grid — Uptime, Clusters today, Model name + quantization, Active connections. Each as a StatCard with JetBrains Mono value and DM Sans sub-label.
- [ ] (S) [UI, BACKEND]: Last activity feed — 5 most recent clusters with event_type pill, Cormorant Garamond italic summary, relevance score, and timestamp (JetBrains Mono).
- [ ] (S) [UI, BACKEND]: System snapshot panel — total clusters, total entities, DB size, Qdrant status, avg relevance, entities with profile. KV-row list style.

### Logs

Live JSONL log stream from the server, filterable and pausable.

- [ ] (M) [BACKEND]: SSE endpoint `GET /admin/logs/stream` — streams JSONL log entries as Server-Sent Events.
- [ ] (M) [UI]: Auto-scrolling log panel — JSONL feed with color-coded syntax (JetBrains Mono 12sp). `component` field highlighted in accent, `entropy_level` colored by severity.
- [ ] (S) [UI]: Log level filter chips — All / Error / Warn / Info / Debug. Active chip: accent underline, inactive: textMuted.
- [ ] (S) [UI]: Component filter — filter by `component` field (ingestion, ai, websocket, etc.).
- [ ] (S) [UI]: Pause/resume button — stops auto-scroll, shows "paused, X new entries" badge.
- [ ] (S) [UI]: Clear button — clears the visible log buffer (does not affect logs on disk).

### Memory Browser

Browse and manage all clusters in the system.

- [ ] (S) [BACKEND]: `GET /admin/clusters` — paginated list with filters: session, date range, event_type, relevance_score range, language.
- [ ] (S) [UI]: Cluster list — Memory Cluster Card style from the app: event_type pill, JetBrains Mono timestamp, Cormorant Garamond italic summary excerpt, relevance badge (success/warning/muted).
- [ ] (S) [UI]: Filter sidebar — event_type multi-select, relevance range slider, date picker, language dropdown.
- [ ] (S) [UI]: Cluster detail drawer — slides in from the right: full summary, raw transcripts, entities mentioned, embedding metadata.
- [ ] (S) [UI, BACKEND]: Flag for deletion action on cluster — writes to `trash_candidates` with a note, surfaces in the Trash section.
- [ ] (S) [UI]: Pagination — "load more" at the bottom, shows total count.

### Entity Graph

Visualization of the relationship network built up over time.

- [ ] (M) [BACKEND]: `GET /admin/entities/graph` — returns nodes (entities) and edges (relationships) as JSON for graph rendering.
- [ ] (M) [UI]: Force-directed graph — Canvas 2D, nodes colored by entity_type, edge thickness = relationship_strength. Similar rendering approach to the neural field animation in the app. Accent `#8B7CF6` for hover/active state.
- [ ] (S) [UI]: Entity detail panel — click a node to show: name, type, encounter_count, context_tags, profile summary (if generated), recent clusters mentioning it.
- [ ] (S) [UI]: Entity table view — sortable by encounter_count, last_seen, entity_type. Toggle between graph and table.
- [ ] (S) [UI, BACKEND]: `GET /admin/entities` — paginated entity list for the table view.
- [ ] (S) [UI]: Search field — filter entities by name (live substring search in the frontend).

### Configuration

Edit server configuration directly from the admin panel.

- [ ] (S) [BACKEND]: `GET /admin/config` — returns current `AppConfig` as JSON (encryption key omitted).
- [ ] (S) [BACKEND]: `PATCH /admin/config` — update allowed fields: response_language, cluster_timeout, entity profile threshold, DDNS settings.
- [ ] (S) [UI]: Settings form — response language selector (ISO 639-1), cluster timeout slider with JetBrains Mono value display, entity profile threshold input.
- [ ] (S) [UI]: DDNS status card — current hostname, last updated timestamp, enable/disable toggle.
- [ ] (S) [UI]: mTLS certificate status — expiry dates for CA cert and server cert, days remaining. Warning color `#D4956A` under 30 days, success `#6BA98F` otherwise.
- [ ] (S) [UI]: Save button sends PATCH, toast confirms success.
- [ ] (S) [UI, BACKEND]: Danger zone — factory reset panel at the bottom of Config. Requires typing "RESET" into an input field to unlock the button. On confirm: deletes all clusters, entities, profiles, devices, and config from SQLite and Qdrant, restarts the server process into initial setup state. `POST /admin/reset` endpoint, protected by the same type-to-confirm check server-side.

### Devices (Trusted Devices)

View and manage which devices have access via mTLS.

- [ ] (S) [BACKEND]: `GET /admin/devices` — list of registered client certs (CN, first_seen, last_seen, revoked status).
- [ ] (S) [BACKEND]: `POST /admin/devices/:cn/revoke` — marks cert as revoked in SQLite, future connections from this cert are refused.
- [ ] (S) [UI]: Device list — card per device: cert CN as name, last_seen (JetBrains Mono), connected/disconnected/revoked badge, revoke button.
- [ ] (S) [UI]: Revoke confirmation modal — "This device will need to re-provision to connect again."

### User Profile

View and edit the user profile data injected as AI context on every query.

- [ ] (S) [BACKEND]: `GET /admin/profile` — returns `user_profile` row and AI-generated profile summary.
- [ ] (S) [BACKEND]: `PATCH /admin/profile` — update onboarding answers and trigger re-generation of the profile summary.
- [ ] (S) [UI]: Profile view — Q&A pairs in list format, AI-generated summary in Cormorant Garamond italic, last_updated timestamp.
- [ ] (S) [UI]: Edit mode — inline editing of answers, save button triggers re-generation via LLM, loading state during generation.

### Trash Review

Review clusters the AI has flagged for deletion due to low relevance.

- [ ] (S) [BACKEND]: `GET /admin/trash` — list of `trash_candidates` with cluster info and AI-generated reason.
- [ ] (S) [UI]: Trash list — cluster summary, AI deletion reason in textMuted italic, timestamp.
- [ ] (S) [UI]: Confirm delete button — permanently deletes cluster, transcripts, and removes from Qdrant.
- [ ] (S) [UI]: Restore button — moves cluster back to the clusters table, removes from trash_candidates.
- [ ] (S) [UI]: Delete all button with confirmation modal — clears the entire trash_candidates table.

### Hardware Monitor

Real-time system telemetry for the server machine — like `htop` / `btop` but integrated into the admin panel with the Ombra design language.

- [ ] (M) [BACKEND]: `GET /admin/hardware` — snapshot of CPU, RAM, disk, temperatures, network. Uses the `sysinfo` crate (pure Rust, cross-platform: Linux, macOS, Windows).
- [ ] (S) [BACKEND]: SSE endpoint `GET /admin/hardware/stream` — pushes a hardware snapshot every 2s as Server-Sent Events for live UI updates.
- [ ] (S) [UI]: CPU panel — overall CPU usage (%), per-core breakdown as mini progress bars, model name, logical core and thread count. JetBrains Mono for all values.
- [ ] (S) [UI]: RAM panel — total, used, available, swap used/total. Horizontal progress bar in accent `#8B7CF6`, values in JetBrains Mono.
- [ ] (S) [UI]: Disk panel — per mount point: device name, mount path, total/used/free, filesystem type. Makes it easy to see if GGUF models and SQLite are using expected space.
- [ ] (S) [UI]: Temperature panel — CPU package temp (°C) and per-core temps where available from `sysinfo`. Color-coded: success `#6BA98F` below 70°C, warning `#D4956A` 70–85°C, recording `#E57373` above 85°C.
- [ ] (S) [UI]: Network panel — bytes sent/received per interface since server start, interface names and IP addresses (LAN + DDNS hostname if configured).
- [ ] (S) [UI]: Ombra process panel — RAM used by the `ombra-server` process specifically, process CPU %, process uptime.
- [ ] (S) [UI]: Hardware profile badge — detected profile (Performance / Efficiency / Edge) and loaded GGUF model name. Same pill style as event_type in clusters.
- [ ] (C) [UI]: History sparklines — mini line charts (Canvas 2D) for CPU % and RAM % over the last 10 minutes, updated live via SSE. Accent color on the line, subtle gradient fill underneath.

### Analytics

Insight into Ombra's activity and memory growth over time. Aggregates computed from SQLite — not real-time.

- [ ] (S) [BACKEND]: `GET /admin/analytics/overview` — aggregate totals: transcripts, clusters, entities, Qdrant embeddings, DB size.
- [ ] (S) [BACKEND]: `GET /admin/analytics/activity?range=30d` — daily activity: clusters per day, new entities per day, average relevance score per day. Range parameter: 7d / 30d / 90d / all.
- [ ] (S) [BACKEND]: `GET /admin/analytics/entities` — encounter_count distribution, entities crossing profile threshold per week, most active entities (top 10).
- [ ] (S) [BACKEND]: `GET /admin/analytics/languages` — distribution of transcript languages as percentages based on `detected_language`.
- [ ] (S) [BACKEND]: `GET /admin/analytics/event-types` — distribution of cluster event_types as pie data.
- [ ] (S) [UI]: Activity heatmap — GitHub-style calendar heatmap, last 52 weeks. Accent intensity = number of clusters that day. Canvas 2D.
- [ ] (S) [UI]: Daily activity bar chart — clusters per day, last 30 days. Bars in accent `#8B7CF6`, JetBrains Mono labels on the x-axis.
- [ ] (S) [UI]: Relevance score histogram — distribution across the 0.0–1.0 scale. Shows the ratio of relevant vs. ambient content.
- [ ] (S) [UI]: Language distribution — horizontal bar chart, ISO code labels in JetBrains Mono.
- [ ] (S) [UI]: Event type donut chart — accent shades per segment, event_type pill-style labels.
- [ ] (S) [UI]: Entity growth curve — line chart: entity count over time, marker at first profile-threshold crossing.
- [ ] (S) [UI]: Memory size over time — DB size (MB) and Qdrant embedding count as a dual-axis line chart. Shows the growth rate of the second brain.
- [ ] (C) [UI]: Time range selector — toggle: 1d / 7d / 30d / 1 year / All. 1d = hourly buckets, 7d = 6h buckets, 30d = daily, 1 year = weekly, All = weekly from first cluster. Refreshes all charts and aggregates.

### Plugins

Extend Ombra with integrations. Official plugins are maintained by the Ombra team. Community plugins are third-party and run with the same server permissions — user installs at their own risk.

- [ ] (M) [BACKEND]: Plugin host — plugins are self-contained binaries or scripts dropped into `~/.ombra/plugins/`. Server discovers them on startup, lists them in `GET /admin/plugins`. Each plugin declares its name, version, author, and description in a manifest file.
- [ ] (S) [BACKEND]: `GET /admin/plugins` — returns list of all known plugins (installed + available from registry) with metadata.
- [ ] (S) [BACKEND]: `POST /admin/plugins/:id/install` and `DELETE /admin/plugins/:id` — install/uninstall a plugin by ID. Install fetches from the official registry or a manifest URL.
- [ ] (S) [UI]: Plugins page — two tabs: Official and Community. Each plugin shown as a card: icon (colored initial), name, version, author, description, install/uninstall toggle button.
- [ ] (S) [UI]: Official tab — plugins maintained by the Ombra team, guaranteed compatible. Currently planned: Calendar (Google/Apple), Notion export, Obsidian vault writer, Slack capture.
- [ ] (S) [UI]: Community tab — third-party plugins with star count. Warning banner: "Community plugins run on your server with full permissions — install only plugins you trust." Submit plugin link for contributors.
- [ ] (W) [BACKEND, Infrastructure]: Plugin registry — hosted at `registry.ombra.io`, a simple JSON manifest listing available plugins with download URLs and checksums. Same trust model as Homebrew taps.

---

## future

- [ ] (W) [UI, AI]: Assistant mode (can do stuff for me)
- [ ] (W) [UI]: Notifications (Remind me of stuff I need to do)
- [ ] (W) [AI]: Picture analysis, for computer and phone
- [ ] (W) [BACKEND]: How much access can I get to mobile data? (battery drain)
- [ ] (W) [UI, AI]: 'Hey Ombra' Function, to ask questions (needs Notifications first)
- [ ] (C) [AI, BACKEND]: Fuzzy entity matching — before creating a new entity, check if a close variant already exists ("Lars" vs "Lars Hansen"); use string similarity + LLM confirmation if ambiguous
