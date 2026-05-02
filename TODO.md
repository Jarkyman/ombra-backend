# TODO

## ombra-common

- DONE {M} [BACKEND] (H): `HardwareProfile` enum (Nano / Edge / Efficiency / Performance) with auto-detection logic
- DONE {M} [BACKEND] (H): Shared `AppConfig` struct (server port, database path, Qdrant URL, model path)
- DONE {M} [BACKEND] (H): `response_language` field on `AppConfig` (ISO 639-1, e.g. "da", "en") — configured at setup, changeable later

## ombra-server

- DONE {M} [BACKEND] (H): SQLx with SQLite — migrations folder + initial schema (transcripts, sessions)
- DONE {M} [BACKEND, Security] (H): AES-256-GCM encryption layer for SQLite at rest (field-level on transcript content)
- DONE {M} [BACKEND, Security] (H): mTLS with `rustls` — client certificate validation for iPhone + hardware device
- TODO {S} [BACKEND, Infrastructure] (M): Let's Encrypt cert via DNS-01 challenge — see "Remote Access Modes → Backend — DuckDNS mode" section for detailed breakdown.
- DONE {M} [BACKEND] (H): WebSocket endpoint for receiving transcripts from the mobile app
- DONE {M} [BACKEND] (H): Transcript ingestion — only discard technically empty transcripts ([BLANK_AUDIO], whitespace-only); store everything else
- DONE {M} [BACKEND] (H): `detected_language` (ISO 639-1) and `raw_whisper_text` fields on transcripts table (migration)
- DONE {M} [BACKEND] (H): REST endpoints for the mobile app (sessions, clusters, settings GET/PATCH)
- DONE {S} [BACKEND] (M): `GET /sessions/:id/transcripts` — list raw transcripts in a session for debug verification before clusters are ready
- DONE {S} [BACKEND] (M): Processing status + app callback — push `{"event": "cluster_ready", ...}` over WebSocket when cluster finishes AI processing, so the app can refresh without polling
- DONE {M} [BACKEND] (H): `tower-http` tracing middleware with JSONL log format
- DONE {S} [BACKEND] (M): Close open clusters on WebSocket disconnect — `flush_session()` on `IngestionPipeline`
- DONE {S} [BACKEND, Infrastructure] (M): Qdrant startup retry — `connect_qdrant_with_retry()` in main.rs; 8 attempts × 3s backoff before panic
- DONE {S} [BACKEND, AI] (M): Cluster processing fallback — if LLM returns garbled JSON, falls back to `event_type="unclassified"`, `relevance_score=0.5`, `event_summary` = truncated raw text
- DONE {S} [BACKEND] (M): `GET /entities` and `GET /entities/:id` — `handlers/entities.rs`, wired in router
- DONE {S} [BACKEND, Security] (M): `config.save()` file permissions — `write_private_file()` uses `OpenOptions::mode(0o600)` on Unix
- DONE {C} [AI, BACKEND] (L): score_cluster + extract_entities in parallel via `tokio::join!` — ~2x faster cluster processing
- TODO {C} [BACKEND, AI] (L): Query response streaming — stream LLM tokens via SSE instead of buffering the full response; eliminates first-token latency for the user

## ombra-ai

- DONE {M} [AI] (H): `InferenceEngine` trait with `llama-cpp-2` bindings (greedy decoding)
- DONE {S} [AI] (M): Sampler chain — `penalties(1.1) → temp → top_p(0.9) → dist`. Two modes: `complete` (temp 0.35) and `complete_structured` (temp 0.1, JSON tasks). Thread count correctly passed via `with_n_threads`.
- DONE {M} [AI] (H): Hardware-aware model loader — detects arch + RAM and selects correct GGUF quantization
- DONE {M} [AI] (H): `EmbeddingEngine` trait with `fastembed` (nomic-embed-text-v1.5)
- DONE {M} [AI] (H): `VectorStore` — connect to Qdrant, upsert embeddings, semantic search
- DONE {S} [AI] (M): Language detection at ingestion — `whichlang` (pure Rust) tags each cluster with ISO 639-1 code before embedding
- DONE {M} [AI] (H): RAG pipeline — embed query → retrieve context from Qdrant → prompt LLM → concise factual answer
- DONE {S} [AI] (M): Cross-language query handling — LLM always responds in the language configured in `AppConfig.response_language`
- DONE {S} [AI] (M): System prompt template includes response language instruction globally

## Ingestion Pipeline

Design decision: do as much as possible the moment a transcript arrives.
Idle time is for retrospective work on old data — not for catching up on current data.
When a cluster closes, it should already be fully processed, embedded, and queryable.

Ingestion flow per transcript chunk:
1. Discard if technically empty ([BLANK_AUDIO], whitespace-only)
2. Detect language (ISO 639-1)
3. Append to current open cluster (3-5 min time window)

When a cluster closes (time window expires or session ends):
4. AI scores cluster → event_type + relevance_score (0.0–1.0)
5. AI generates event_summary (this is what gets embedded, not raw lines)
6. AI extracts named entities from the cluster
7. Store cluster + summary + score in SQLite
8. Embed event_summary → Qdrant with language + event_type metadata
9. Upsert extracted entities → increment encounter_count, update last_seen
10. If any entity crosses profile threshold → generate profile summary + embed immediately

- DONE {M} [BACKEND] (H): Full ingestion pipeline as a single async pipeline in `ombra-server`
- DONE {M} [BACKEND] (H): `clusters` table — id, started_at, closed_at, event_type, relevance_score, event_summary, language
- DONE {M} [BACKEND] (H): `cluster_id` FK to transcripts table (migration)
- DONE {M} [BACKEND] (H): Cluster window management — track open cluster per session, auto-close on timeout
- TODO {S} [BACKEND, AI] (M): `trash_candidates` table — AI writes low-relevance clusters here with reason, user confirms deletion

## Knowledge Graph — Brain-Like Memory

Design decision: model the system after how human memory works.
- Short-term memory = raw transcript clusters (last 24-48h, unprocessed)
- Long-term memory = embedded event summaries + entity profiles in Qdrant
- Working memory = context window during an LLM call
- Sleep / idle time = when the AI consolidates, builds profiles, scores relevance

Entities are people, places, projects, and topics that appear repeatedly.
A stranger on the bus does not get a profile. Someone who appears 5+ times does.

### Entity Schema (SQLite)

- DONE {M} [BACKEND] (H): `entities` table — id, name, entity_type (person / place / project / topic), first_seen, last_seen, encounter_count
- DONE {M} [BACKEND] (H): `entity_context_tags` table — entity_id, tag (work / family / friends / project / other)
- DONE {M} [BACKEND] (H): `entity_mentions` table — links entity_id to a transcript cluster_id
- DONE {M} [BACKEND] (H): `entity_relationships` table — entity_id, related_entity_id, relationship_type, strength (float)

### Entity Profile Building

- DONE {M} [AI, BACKEND] (H): AI extracts named entities from each scored cluster at ingestion time
- DONE {M} [AI, BACKEND] (H): If entity already exists: increment encounter_count, update last_seen, strengthen relationships
- DONE {M} [AI, BACKEND] (H): If entity is new: create with encounter_count = 1, no profile yet
- DONE {S} [AI, BACKEND] (M): Profile generation threshold — when encounter_count crosses a configurable minimum (default: 5), AI generates a full profile summary and embeds it in Qdrant
- TODO {C} [AI, BACKEND] (L): Profiles re-generated during idle time as new encounters accumulate

### Context Inference

- TODO {C} [AI, BACKEND] (L): Work context inferred from: recurring people + daytime hours + project/task language
- TODO {C} [AI, BACKEND] (L): Family context inferred from: home location + recurring names + recurring environment
- TODO {C} [AI, BACKEND] (L): Friends context inferred from: social patterns, leisure hours, recurring names outside work
- TODO {C} [AI, BACKEND] (L): AI assigns and revises context tags automatically — user can correct via app

### Query Enrichment

- DONE {S} [AI, BACKEND] (M): When answering a query, retrieve both relevant event summaries AND relevant entity profiles as context
- DONE {S} [AI, BACKEND] (M): Entity profiles make answers richer: "what did I talk to Lars about last time?" pulls Lars's profile + recent clusters mentioning Lars

## Idle-Time Work

Retrospective only — current data is already fully processed at ingestion.

- TODO {C} [AI, BACKEND] (L): Re-score old clusters as entity profiles mature — a cluster scored as "ambient" early on may gain relevance once the entities in it are better understood
- TODO {C} [AI, BACKEND] (L): Deepen entity relationship graph — recalculate relationship strengths across accumulated history
- TODO {S} [AI, BACKEND] (M): Write low-relevance clusters to `trash_candidates` with AI-generated reason
- TODO {S} [UI, BACKEND] (M): User-facing "review trash" prompt — surface candidates in mobile or TUI, user confirms deletion
- TODO {M} [BACKEND] (H): Never auto-delete — always require explicit user confirmation

## ombra-cli

- DONE {M} [CLI, Infrastructure] (H): `ombra install` — ratatui TUI wizard: model selection, language, remote access, certs, background Qdrant + model download + server build, onboarding questionnaire, systemd service install
- DONE {S} [CLI] (M): `ombra status` — reads `ombra.toml`, TCP-pings server port, checks `systemctl is-active ombra`, shows model name + DB file size, color-coded output
- DONE {S} [CLI] (M): `ombra upgrade` — runs `git pull` → `cargo build --release` → `sudo systemctl restart ombra` with step-by-step output (prints manual instructions on WSL2)
- TODO {C} [CLI, UI] (L): Ratatui dashboard — real-time CPU/RAM/NPU telemetry
- TODO {C} [CLI, UI] (L): JSONL log stream panel in Ratatui dashboard
- TODO {C} [CLI, UI] (L): Model deployment status panel in Ratatui dashboard

## User Onboarding & Personalization

Design decision: when the backend is set up for the first time, the AI conducts a short
onboarding interview via the CLI. Answers are stored as a structured user profile that the
AI uses as permanent context on every query. The profile evolves automatically over time
as the AI learns more — but it needs a foundation to start from.

### Setup Onboarding (first-time only)

- DONE {M} [Infrastructure] (H): `setup.sh` runs onboarding questionnaire while background jobs run in parallel. Answers written to `user_profile.toml`. User can skip any question or type 'done' to jump to progress bar.
- DONE {M} [BACKEND] (H): Server reads `user_profile.toml` on first boot → inserts into `profile_facts` SQLite table (`onboarding.rs`)
- DONE {M} [AI, BACKEND] (H): AI generates a free-text profile summary from the answers → stored in SQLite + injected as "About the user:" section in every RAG prompt
- DONE {M} [BACKEND] (H): Profile is never overwritten by onboarding again — `run_if_needed()` skips if DB row already exists
- TODO {S} [AI, BACKEND] (M): Embed user profile summary in Qdrant (currently only in AppState/prompt — not searchable as a vector)
- TODO {C} [AI, UI] (L): When user is filling questions and AI is downloaded, feed the information to it and ask it to generate follow-up questions to better understand the person

### Ongoing Personalization

- TODO {C} [AI] (L): AI proactively asks clarifying questions during idle time when it has identified gaps in its understanding of the user ("I keep hearing about 'projektet' — what is that?")
- TODO {C} [AI, UI] (L): Questions are queued and surfaced to the user in the mobile app or TUI, not asked mid-conversation
- TODO {C} [AI, UI] (L): User can answer, skip, or dismiss — all responses update the profile

## Infrastructure

- DONE {M} [Infrastructure] (H): `docker-compose.yml` — Qdrant sidecar
- DONE {M} [Infrastructure] (H): `install.sh` — `curl | bash` bootstrap: OS check (Ubuntu), apt deps, Docker (official repo), Rust via rustup, git clone to `~/ombra`, builds `ombra-cli`, execs `ombra install`
- DONE {S} [Infrastructure] (M): `setup.sh` — legacy wizard (superseded by `install.sh` + `ombra install`)
- DONE {M} [Infrastructure] (H): Model download logic — detect hardware profile and pull correct GGUF file, user can override
- DONE {M} [Infrastructure, Security] (H): Config and user profile written with `0o600` permissions (no world-readable window)
- DONE {M} [Infrastructure, Security] (H): `generate_dev_certs.sh` auto-detects server LAN IP and includes it in cert SAN
- DONE {S} [Infrastructure] (M): UPnP automatic port mapping — `network/upnp.rs`, uses `igd` crate, logs warning if router doesn't support UPnP
- DONE {S} [Infrastructure] (M): DDNS — DuckDNS update loop every 5 min. `DnsUpdater` trait abstraction. `AppConfig.ddns: Option<DdnsConfig>`.
- DONE {S} [Infrastructure] (M): DuckDNS is optional — server runs locally only via `ombra.local` and LAN IP when remote access is disabled
- DONE {S} [Infrastructure] (M): mDNS hostname (`ombra.local`) — avahi-daemon installed by setup.sh, cert SAN includes `DNS:ombra.local`
- DONE {S} [BACKEND, Security] (M): Trusted Devices — migration 0009 adds `trusted_devices (cn, label, first_seen, last_seen, revoked_at)`. Server registers the configured client cert at startup (x509-parser extracts CN). `GET /admin/devices`, `POST /admin/devices/:cn/revoke`, `DELETE /admin/devices/:cn` wired.
- DONE {C} [BACKEND, UI] (L): In-app QR code generation — `POST /provision/rotate` (mTLS-protected): generates new provision token, writes to disk (mode 0o600), returns `{ host, port, provision_port, token, ca_fp }` QR payload for the app to scan
- TODO {C} [Infrastructure] (L): Register `get.ombra.io` and set up redirect to raw GitHub install.sh — so the install command becomes `curl -sSf https://get.ombra.io | bash`
- TODO {W} [Infrastructure] (L): Ombra Relay — minimal relay server for connection routing only (not data). Necessary for users behind CGNAT where UPnP and port forwarding are physically impossible. Deliberate infrastructure investment for when the product goes to market.
- TODO {C} [BACKEND, Security, Infrastructure] (L): Investigate moving admin panel to a dedicated local-only port (e.g. 8083) that is never included in UPnP mapping — same pattern as the provision server (port 8081). This would enforce LAN-only at the network layer instead of application layer, making the `lan_only` middleware redundant. Trade-off: requires a second Axum listener and splitting admin routes/static files off the main router.
- TODO {M} [Infrastructure, CLI, UI] (H): Remote access mode system — setup wizard lets users choose how Ombra is reachable. Active: Local only, DuckDNS, Tailscale. Grayed with "(coming soon)": OmbraDNS, ZeroTier, Cloudflare Tunnel, Remote.It, ngrok, packetriot. See "Remote Access Modes" section for full breakdown.

### Certificate Auto-Renewal

Design decision: once a device is connected, it should stay connected forever without manual intervention.
Client certs are valid for 1 year. The server detects approaching expiry and proactively issues a new cert
while the old one is still valid — the app rotates silently. The user never thinks about certificates.

- TODO {M} [BACKEND, Security] (H): Certificate expiry monitor — on server startup and once daily, read expiry dates from all client cert files on disk. Store in SQLite (`cert_expiry` table: device CN, expiry timestamp, last_renewed). Log a warning when any cert is within 60 days of expiry.
- TODO {M} [BACKEND, Security] (H): Auto-renewal endpoint `GET /provision/renew-cert` — authenticated via mTLS. Server generates new client cert signed by CA, valid for another year, returns as JSON `{ cert_pem, key_pem, ca_pem }`. Old cert stays valid until it expires — no hard cutover.
- TODO {M} [MOBILE, Security] (H): App checks cert expiry on launch and after each successful connection. If cert expires within 30 days, silently calls `GET /provision/renew-cert`, replaces stored cert+key on device, continues without interrupting the user.
- TODO {S} [BACKEND, Security] (M): Server cert expiry monitor — if using self-signed server cert, track its expiry. If using Let's Encrypt, verify that the certbot renewal timer is active and log its next-run timestamp.
- TODO {S} [CLI, Security] (M): `ombra renew-certs` command — manually triggers re-generation of all client certs and prints instructions for re-provisioning devices that cannot auto-renew. Useful as a fallback if auto-renewal fails.
- TODO {S} [BACKEND, Security] (M): Renewed cert written to disk atomically — generate to temp file, then `rename()` into place. Avoids incomplete cert file window on server crash.
- TODO {S} [BACKEND, Security] (M): Grace period overlap — when renewed cert is issued, server accepts both old and new cert until old one expires. Prevents race where app has new cert but server hasn't persisted it yet.

## Remote Access Modes

Design decision: users choose how their Ombra server is reachable from outside the home network at setup time.
All modes keep mTLS — transport security is always on.
The admin panel is always LAN-only, regardless of mode.

Active in wizard: **Local only**, **DuckDNS**, **Tailscale**.
Grayed with "(coming soon)": OmbraDNS, ZeroTier, Cloudflare Tunnel, Remote.It, ngrok, packetriot.

### Config

- DONE {M} [BACKEND, Infrastructure] (H): `RemoteAccessMode` enum in `ombra-common` — variants: `LocalOnly | DuckDns | Tailscale | ZeroTier | CloudflareTunnel | RemoteIt | Ngrok | Packetriot | OmbraDns`. Add `remote_access_mode: RemoteAccessMode` field to `AppConfig` (default: `LocalOnly`, serde-defaulted). Existing `ddns: Option<DdnsConfig>` stays as DuckDNS sub-config.

### Setup Wizard (ombra install)

- DONE {M} [CLI, UI] (H): Connection mode picker — `Step::ConnectionModeSelect` replaces old Y/N RemoteAccessChoice. 9-entry list (↑↓ navigation), first 3 selectable, 6 grayed with "(coming soon)". Navigation skips coming-soon entries.
- DONE {M} [CLI] (H): Local only setup flow — selecting LocalOnly goes directly to Starting; writes `remote_access_mode = "local_only"` to config.
- DONE {M} [CLI] (H): DuckDNS setup flow — selecting DuckDNS goes to token input → subdomain input → Starting; writes `remote_access_mode = "duck_dns"` + `[ddns]` section to config.
- DONE {M} [CLI] (H): Tailscale setup flow — `Step::TailscaleCheck` runs `detect_tailscale_status()` once on entry (checks `tailscale --version` + `tailscale ip -4`). Shows: not installed (install URL + instructions), not logged in (`sudo tailscale up`), or connected (green IP). Enter proceeds to Starting regardless. Writes `remote_access_mode = "tailscale"` to config.
- TODO {S} [CLI] (M): DuckDNS token validation — validate token+subdomain by calling DuckDNS update API and checking for `OK` response before accepting. Re-prompt on failure.

### Backend — all modes

- DONE {M} [BACKEND] (H): `GET /admin/connection-status` — returns `{ mode, lan_ip, server_port, tailscale_ip?, duckdns_hostname?, duckdns_token_set }`. Tailscale IP detected on-demand via `tailscale ip -4` subprocess.
- DONE {S} [BACKEND] (M): Log current connection mode at startup under `component = "network"`.

### Backend — Tailscale mode

- DONE {M} [BACKEND, Security] (H): Extend `require_lan` middleware — when `remote_access_mode = "tailscale"`, also allow `100.64.0.0/10` (Tailscale CGNAT range). Middleware now reads mode from `AppState` via `from_fn_with_state`. All existing LAN tests pass + new `tailscale_cgnat_range` test added.
- DONE {S} [BACKEND] (M): Tailscale IP detection — `detect_tailscale_ip()` in `connection_status` handler runs `tailscale ip -4` via `spawn_blocking`, returns `None` if Tailscale not running.

### Backend — DuckDNS mode (Let's Encrypt DNS-01)

- TODO {M} [BACKEND, Infrastructure] (H): Let's Encrypt DNS-01 cert issuance — add `instant-acme = "0.7"` to `ombra-server/Cargo.toml`. On first boot in DuckDNS mode with no LE cert on disk: create ACME account with Let's Encrypt production, order cert for `{subdomain}.duckdns.org`, receive DNS-01 challenge value, write `_acme-challenge.{subdomain}` TXT record via DuckDNS API (`?txt={value}`), poll for DNS propagation (5s backoff, up to 3 min), notify ACME to validate, download cert chain + key, write to `certs/le-server.crt` and `certs/le-server.key` (mode 0o600), hot-reload TLS config via `RustlsConfig::reload_from_config`.
- TODO {M} [BACKEND, Infrastructure] (H): LE cert auto-renewal — extend `cert_monitor` background task: when mode is `duck_dns` and LE cert expires within 30 days, re-run DNS-01 flow automatically. Hot-reload TLS on success. On failure: log error, retry after 24h, surface error in `/admin/connection-status`.
- TODO {S} [BACKEND] (M): ACME account key persistence — store ACME account private key at `certs/le-account.key` (mode 0o600). Reuse on renewals to avoid re-registering with Let's Encrypt (rate limit protection).
- TODO {S} [BACKEND] (M): DuckDNS TXT record cleanup — after DNS-01 validation (success or failure), clear the TXT record via DuckDNS API (`?txt=` empty) to keep DNS tidy.
- TODO {S} [BACKEND, Security] (M): Relax `require_lan` for non-admin routes in DuckDNS mode — mobile app connects from public IPs. Admin sub-router stays LAN-only. After first successful LE cert issuance, update `tls_server_cert_path` and `tls_server_key_path` in `ombra.toml` to point at `certs/le-*.{crt,key}`.

### Admin Panel — Connection Status

- DONE {M} [UI, BACKEND] (H): Replace static DDNS panel in Config with live `ConnectionPanel` — fetches `GET /admin/connection-status`. Shows mode badge + LAN IP + server port + Tailscale IP (when Tailscale mode) + DuckDNS hostname + token status (when DuckDNS mode).
- TODO {S} [UI] (M): DuckDNS card rows — add last IP update timestamp, cert type badge (Let's Encrypt), cert expiry badge (reuses `certBadge()` from TlsPanel), "Force renew" button (`POST /admin/renew-le-cert`). Needs LE cert issuance backend first.
- TODO {S} [UI] (M): Tailscale card rows — add MagicDNS hostname if available, reachability status. Needs `tailscale status --json` parsing in backend.

---

## Testing

### Unit Tests (per crate, run with `cargo test`)

- DONE {M} [Testing, BACKEND] (H): `ombra-common` — encryption: roundtrip, wrong key, empty input, unicode, nonce uniqueness, key parsing
- DONE {M} [Testing, BACKEND] (H): `ombra-common` — hardware: profile detection, model_filename, huggingface_repo format
- DONE {M} [Testing, BACKEND] (H): `ombra-common` — config: TOML roundtrip, encryption key parseable
- DONE {M} [Testing, BACKEND] (H): `ombra-server` — ingestion: `is_empty_transcript` rejects all known empty tags + whitespace, accepts real content
- DONE {M} [Testing, BACKEND] (H): `ombra-server` — cluster: add transcripts, accumulate in session, separate sessions, drain on timeout=0, close by session

### Integration Tests (real SQLite, no mocks)

- DONE {M} [Testing, BACKEND] (H): DB: insert transcript with encryption, read back and verify decrypted content matches original
- DONE {M} [Testing, BACKEND] (H): DB: raw DB row does not contain plaintext (encryption verified at storage layer)
- DONE {M} [Testing, BACKEND] (H): DB: wrong key returns error on read
- DONE {M} [Testing, BACKEND] (H): DB: list transcripts by session returns chronological order
- DONE {M} [Testing, BACKEND] (H): DB: list by session excludes other sessions
- DONE {M} [Testing, BACKEND] (H): DB: insert cluster, retrieve by id, list newest-first, pagination, filter by session
- DONE {M} [Testing, BACKEND] (H): DB: migration runs cleanly on a fresh in-memory database (implicit in all DB tests)
- TODO {C} [Testing, BACKEND] (L): Ingestion pipeline: end-to-end — WebSocket message → stored in DB → cluster updated

### Security Tests

- TODO {C} [Testing, Security] (L): mTLS: request with valid client cert → 200 OK
- TODO {C} [Testing, Security] (L): mTLS: request without client cert → TLS handshake failure (connection refused, not 401)
- TODO {C} [Testing, Security] (L): mTLS: request with a cert signed by a different CA → TLS handshake failure
- TODO {C} [Testing, Security] (L): Encryption: verify that raw SQLite file contains no plaintext transcript content

### Flow Tests (full system running)

- TODO {S} [Testing, Infrastructure] (M): Setup flow: run `generate_dev_certs.sh` → start server → health check passes
- TODO {C} [Testing, BACKEND] (L): Transcript flow: send chunk via WebSocket → appears in DB encrypted → readable via query
- TODO {S} [Testing, BACKEND] (M): Empty filter: send [BLANK_AUDIO] → nothing written to DB
- TODO {S} [Testing, BACKEND] (M): Cluster flow: send multiple chunks → cluster groups them → cluster closes after timeout

### VM-Based Hardware Profile Testing

Note: use UTM (free, macOS) to spin up VMs with specific RAM allocations to test each profile.
UTM uses QEMU under the hood and supports both x86_64 and ARM64 guests.

- TODO {C} [Testing, Infrastructure] (L): Set up UTM on macOS with Ubuntu 24.04 x86_64 VM, 32GB RAM allocation → verify Performance profile detected
- TODO {C} [Testing, Infrastructure] (L): Set up UTM with 8GB RAM allocation → verify Efficiency profile detected
- TODO {C} [Testing, Infrastructure] (L): Set up UTM with ARM64 guest → verify Edge profile detected
- TODO {C} [Testing, Infrastructure] (L): Run full setup flow inside VM: certs, config, server start, health check
- TODO {C} [Testing, Infrastructure] (L): Verify correct GGUF model filename is selected per profile without downloading the actual model

## UTM / Hardware Test Findings

Issues and improvements found during real-hardware and VM testing.

- TODO {S} [UI, BACKEND] (M): Model selection only shows models the hardware can actually run — filter out profiles that require more RAM than detected. Currently all options always show.
- TODO {C} [UI, BACKEND] (L): Advanced mode allows manual model selection (any GGUF repo + filename) for power users who want to override the auto-detected profile
- TODO {C} [AI, BACKEND] (L): Support additional model families — extend `HardwareProfile` with Llama 3.x, Mistral, and Phi-4 variants. Each family needs its own `chat_template()` implementation.
- TODO {S} [UI, BACKEND] (M): Onboarding questionnaire needs more questions — cover daily routines, hobbies, relationships, goals, communication style etc. to give the AI a richer starting context
- TODO {C} [CLI, BACKEND] (L): Add `setup.sh --profile` flag to re-enter the onboarding questionnaire at any time after setup

## Backend Code Review Action Items

### Security & Vulnerabilities

- DONE {M} [Security, BACKEND] (H): `setup.sh` file permissions race condition — `umask 077` set before creating `ombra.toml` and `user_profile.toml`
- TODO {S} [Security, BACKEND] (M): `setup.sh` model validation — Add SHA256/MD5 validation to prevent loading corrupted or tampered GGUF files
- TODO {S} [Security, Docs] (M): `ombra.toml` security — Document plaintext SQLite encryption key risk

### Performance & Optimization

- TODO {C} [AI, BACKEND] (L): KV cache quantization — set `cache_type_k` and `cache_type_v` to `q8_0` in `LlamaContextParams` in `ombra-ai/src/model_loader.rs`. Reduces KV cache memory by ~50% vs fp16 with minimal quality loss — especially valuable on edge hardware.
- DONE {M} [Optimization, BACKEND] (H): Fix N+1 query (`get_clusters_by_ids`) — use `sqlx::QueryBuilder` batch queries
- DONE {M} [Optimization, BACKEND] (H): Fix N+1 query (`assign_transcripts_to_cluster`) — rewrite to batch update
- DONE {M} [Optimization, BACKEND] (H): Missing SQLite transactions — wrap cluster saving in `pool.begin().await`

### Robustness & Error Handling

- TODO {S} [BACKEND, Infrastructure] (M): `setup.sh` dependency check — Check `/etc/os-release` first
- DONE {M} [Security, BACKEND] (H): API error messages — `OmbraError` does not leak raw database errors; structured JSON with `error` codes

### Architecture & Code Quality

- DONE {M} [BACKEND] (H): Stale open clusters on restart — sweep on server startup, orphaned transcripts re-queued for processing

## Pre-production Cleanup

- DONE {M} [Formatting, BACKEND] (H): Fix `dead_code` warnings in `entity.rs`, `transcript.rs`, `user_profile.rs` — `cargo clippy -- -D warnings` passes with zero warnings

---

## Admin Panel

Web UI served by `ombra-server`, accessible at `ombra.local/admin` or `<LAN-IP>/admin`. Local network only — never exposed through the DDNS/public endpoint. Vanilla HTML/CSS/JS in `ombra-server/admin/`. No build step. Design tokens in `tokens.js`.

### Foundation

- DONE {S} [BACKEND, UI] (M): Serve static files from `ombra-server/admin/` — Axum `ServeDir` on the `/admin` route, path configurable via `AppConfig.admin_dir` (default: `admin/`)
- DONE {M} [BACKEND, Security] (H): Admin routes protected by mTLS (same as all other routes — no additional auth needed)
- DONE {S} [BACKEND, Security] (M): Admin routes only accessible from loopback/LAN interfaces — `middleware/lan_only.rs` checks remote IP; handles IPv4, IPv6, and IPv4-mapped IPv6; rejects with 403 from public ranges
- TODO {C} [BACKEND, Security, UI] (L): Admin panel login page — mTLS already authenticates devices, but a browser login adds a human-facing auth layer for anyone on the LAN. Options: Linux PAM (authenticate against the system user running ombra via the `pam` crate), or a simple hashed password stored in `ombra.toml` with a session cookie. PAM is more natural on Linux and requires no separate password management.
- TODO {S} [UI] (M): Skeleton loading states — pulsing placeholder cards for all data-fetching sections. CSS `@keyframes shimmer` with a single reusable `.skeleton` class.
- DONE {S} [UI] (M): CSS design tokens — `tokens.js` with OMBRA_LIGHT / OMBRA_DARK palettes; `prefers-color-scheme` support with manual toggle
- DONE {S} [UI] (M): Base layout — left sidebar nav (collapsible), main content area, top header bar, Ombra enso logo at top of sidebar
- DONE {S} [UI] (M): Navigation sidebar — Dashboard, Logs, Memory, Entities, Hardware, Analytics, Config, Devices, Profile, Trash, Plugins
- DONE {S} [UI] (M): Page header pattern — Cormorant Garamond italic 26sp title, DM Sans 14sp subtitle, action buttons right
- DONE {S} [UI] (M): Toast notifications — slide in from bottom-right, auto-dismiss 3s
- DONE {S} [UI] (M): Consistent card components — border-radius 18dp, surface background, Level 1 shadow, 1px border
- TODO {C} [UI] (L): Sidebar update badge — shows current server version at bottom; pulsing "Update" badge when newer release is available on GitHub; clicking triggers `ombra upgrade`

### Dashboard

- DONE {S} [UI, BACKEND] (M): Server health panel — `GET /health` + `GET /admin/analytics/overview` for uptime, Qdrant status, DB size
- DONE {S} [UI, BACKEND] (M): Connect app QR panel — renders provisioning QR from `POST /provision/rotate` with "Regenerate" button
- DONE {S} [UI, BACKEND] (M): Stat grid — Uptime, Clusters today, Model name + quantization, Active connections
- DONE {S} [UI, BACKEND] (M): Last activity feed — 5 most recent clusters with event_type pill, italic summary, relevance score, timestamp
- DONE {S} [UI, BACKEND] (M): System snapshot panel — total clusters, entities, DB size, Qdrant status, avg relevance, entities with profile

### Logs

- DONE {S} [BACKEND] (M): SSE endpoint `GET /admin/logs/stream` — stream JSONL log entries as Server-Sent Events (currently polling `GET /admin/logs` every 2s)
- DONE {M} [UI] (H): Auto-scrolling log panel — JSONL feed with color-coded syntax (JetBrains Mono); `component` field in accent, `entropy_level` colored by severity
- DONE {S} [UI] (M): Log level filter chips — All / Error / Warn / Info / Debug
- DONE {S} [UI] (M): Component filter — filter by `component` field (ingestion, ai, websocket, etc.)
- DONE {S} [UI] (M): Pause/resume button — stops auto-scroll, shows "paused, X new entries" badge
- DONE {S} [UI] (M): Clear button — clears visible log buffer (does not affect logs on disk)

### Memory

- DONE {S} [BACKEND] (M): Cluster list — paginated, load-more via `GET /clusters`
- DONE {S} [UI] (M): Cluster list — Memory Cluster Card style: event_type pill, timestamp, summary excerpt, relevance badge
- DONE {S} [UI] (M): Filter sidebar — event_type multi-select, relevance range slider, date picker, language dropdown
- DONE {S} [UI] (M): Cluster detail drawer — slides in from right: full summary, raw transcripts, entities mentioned, embedding metadata
- DONE {S} [UI, BACKEND] (M): Flag for deletion — `POST /clusters/:id/flag` surfaces cluster in Trash section
- DONE {S} [UI] (M): Pagination — "load more" at the bottom, shows total count

### Entities

- DONE {C} [BACKEND] (L): `GET /entities/graph` — return nodes (entities) and edges (relationships) as JSON, deduplicated by canonical direction, capped at 200 nodes.
- DONE {C} [UI] (L): Force-directed graph — Canvas 2D visualization of entity relationship network. Tab switcher (List / Graph) in entities section; shared selected-entity state with detail panel.
- DONE {S} [UI] (M): Entity detail panel — click entity to show: name, type, encounter_count, context_tags, profile summary, recent clusters
- DONE {S} [UI] (M): Entity table view — sortable by encounter_count, last_seen, entity_type
- DONE {S} [BACKEND] (M): Entity list — `GET /entities` paginated
- DONE {S} [UI] (M): Search field — live substring filter by entity name

### Configuration

- DONE {S} [BACKEND] (M): Config read/write via `GET /settings` and `PATCH /settings`
- DONE {S} [UI] (M): Settings form — response language selector, cluster timeout slider with JetBrains Mono value display, entity profile threshold input
- DONE {S} [UI] (M): DDNS status card — current hostname, last updated timestamp, enable/disable toggle
- DONE {S} [UI] (M): mTLS certificate status — expiry dates for CA cert and server cert, days remaining (warning color < 30 days)
- DONE {S} [UI] (M): Save button sends PATCH, toast confirms success
- DONE {S} [UI, BACKEND] (M): Danger zone — two actions: purge (clusters/transcripts/embeddings, entities kept) and factory reset (all data). Type-to-confirm modal with loading/success/error states. `POST /admin/purge` and `POST /admin/factory-reset`.

### Devices

- DONE {S} [BACKEND] (M): `GET /admin/devices` — list registered client certs (CN, first_seen, last_seen, revoked status)
- DONE {S} [BACKEND] (M): `POST /admin/devices/:cn/revoke` — marks cert as revoked in SQLite; future connections from this cert are refused
- DONE {S} [UI] (M): Device list — card per device: cert CN, last_seen, connected/disconnected/revoked badge, revoke button
- DONE {S} [UI] (M): Revoke confirmation modal — "This device will need to re-provision to connect again"

### Profile

- DONE {S} [BACKEND] (M): `GET /profile` — returns profile facts and AI-generated summary
- DONE {S} [BACKEND] (M): `PATCH /profile` — update profile facts
- DONE {S} [BACKEND] (M): `POST /profile/regenerate` — trigger re-generation of profile summary via LLM
- DONE {S} [UI] (M): Profile view — key/value profile facts in list format, AI summary in Cormorant Garamond italic, last_updated timestamp
- DONE {S} [UI] (M): Edit mode — inline editing of facts, save triggers LLM re-generation, loading state during generation

### Trash

- DONE {S} [BACKEND] (M): `GET /clusters/trash` — list clusters flagged via `POST /clusters/:id/flag`
- DONE {S} [UI] (M): Trash list — cluster summary, flag reason in textMuted italic, timestamp
- DONE {S} [UI] (M): Confirm delete — permanently deletes cluster, transcripts, removes from Qdrant
- DONE {S} [UI] (M): Restore button — moves cluster back to clusters table, removes from trash
- DONE {S} [UI] (M): Delete all button with confirmation modal — clears the entire trash

### Hardware

- DONE {M} [BACKEND] (H): `GET /admin/hardware` — snapshot of CPU, RAM, disk, temperatures, network via `sysinfo` crate (pure Rust, cross-platform)
- DONE {C} [BACKEND] (L): SSE endpoint `GET /admin/hardware/stream` — push hardware snapshot every 2s as Server-Sent Events (currently polling every 2s)
- DONE {S} [UI] (M): CPU panel — overall usage %, per-core breakdown as mini progress bars, model name, logical core and thread count
- DONE {S} [UI] (M): RAM panel — total, used, available, swap. Horizontal progress bar in accent
- DONE {S} [UI] (M): Disk panel — per mount point: device name, mount path, total/used/free, filesystem type
- DONE {S} [UI] (M): Temperature panel — CPU package temp + per-core temps. Color-coded: success < 70°C, warning 70–85°C, alert > 85°C
- DONE {S} [UI] (M): Network panel — bytes sent/received per interface, interface names and IP addresses
- DONE {S} [UI] (M): Ombra process panel — server process RAM, CPU %, process uptime
- DONE {S} [UI] (M): Hardware profile badge — detected profile (Performance / Efficiency / Edge / Nano) and loaded GGUF model name
- DONE {C} [UI] (L): History sparklines — CPU % and RAM % over the last 10 minutes via polling

### Analytics

- DONE {S} [BACKEND] (M): `GET /admin/analytics/overview` — aggregate totals: transcripts, clusters, entities, Qdrant embeddings, DB size
- DONE {S} [BACKEND] (M): `GET /admin/analytics/activity?range=30d` — daily activity: clusters per day, new entities per day, avg relevance. Range parameter: 7d / 30d / 90d / all
- DONE {S} [BACKEND] (M): `GET /admin/analytics/entities` — encounter_count distribution, entities crossing profile threshold per week, top 10 most active entities
- DONE {S} [BACKEND] (M): `GET /admin/analytics/languages` — distribution of transcript languages as percentages
- DONE {S} [BACKEND] (M): `GET /admin/analytics/event-types` — distribution of cluster event_types as pie data
- DONE {S} [UI] (M): Activity heatmap — GitHub-style calendar heatmap, last 52 weeks; accent intensity = clusters that day
- DONE {S} [UI] (M): Daily activity bar chart — clusters per day, last 30 days
- DONE {S} [UI] (M): Relevance score histogram — distribution across 0.0–1.0 scale
- DONE {S} [UI] (M): Language distribution — horizontal bar chart with ISO code labels
- DONE {S} [UI] (M): Event type donut chart — accent shades per segment
- DONE {S} [UI] (M): Entity growth curve — entity count over time, marker at first profile-threshold crossing
- DONE {S} [UI] (M): Memory size over time — DB size (MB) and Qdrant embedding count as dual-axis line chart
- DONE {C} [UI] (L): Time range selector — toggle: 1d / 7d / 30d / 1 year / All

### Plugins

- TODO {M} [BACKEND] (H): Plugin host — plugins are self-contained binaries or scripts in `~/.ombra/plugins/`. Server discovers them on startup, listed in `GET /admin/plugins`. Each plugin declares name, version, author, description in a manifest file.
- TODO {S} [BACKEND] (M): `GET /admin/plugins` — list all known plugins (installed + available from registry) with metadata
- TODO {S} [BACKEND] (M): `POST /admin/plugins/:id/install` and `DELETE /admin/plugins/:id` — install/uninstall by ID
- TODO {S} [UI] (M): Plugins page — two tabs: Official and Community. Each plugin: icon, name, version, author, description, install/uninstall toggle.
- TODO {S} [UI] (M): Official tab — plugins by the Ombra team: Calendar (Google/Apple), Notion export, Obsidian vault writer, Slack capture
- TODO {S} [UI] (M): Community tab — third-party plugins with star count and warning banner: "Community plugins run on your server with full permissions — install only plugins you trust"
- TODO {W} [BACKEND, Infrastructure] (L): Plugin registry — hosted at `registry.ombra.io`, JSON manifest listing available plugins with download URLs and checksums
- TODO {C} [AI, BACKEND] (L): MCP server integration — connect Ombra's AI to external MCP servers as tool providers. Requires tool-use/function-calling support in the inference layer first.

---

## Future

- TODO {W} [UI, AI] (L): Assistant mode — can do stuff for me
- TODO {W} [UI] (L): Notifications — remind me of stuff I need to do
- TODO {W} [AI] (L): Picture analysis for computer and phone
- TODO {W} [BACKEND] (L): Mobile data access investigation (battery drain implications)
- TODO {W} [UI, AI] (L): 'Hey Ombra' function to ask questions (requires Notifications first)
- TODO {C} [AI, BACKEND] (L): Fuzzy entity matching — before creating a new entity, check if a close variant already exists ("Lars" vs "Lars Hansen"); use string similarity + LLM confirmation if ambiguous
