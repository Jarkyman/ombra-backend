# Ombra

![Rust](https://img.shields.io/badge/Rust-stable-orange?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Linux-lightgrey?logo=linux&logoColor=white)
![Self-hosted](https://img.shields.io/badge/self--hosted-always-success)

> Listens. Remembers. Never leaves your hardware.

Ombra is a wearable memory system built around a single principle: **your data stays on your hardware, always.** A BLE wearable captures audio, a mobile app transcribes it locally on-device, and this backend processes, stores, and queries everything — with no cloud involved at any step.

---

## Security model

Authentication is **certificate-based mTLS** — no API keys, no OAuth, no accounts. Only devices holding a valid client certificate can connect. Requests without one are rejected at the TLS handshake.

- All transcript content is encrypted at rest with AES-256-GCM (field-level, SQLite)
- Certificates are generated locally during setup and never leave your machine
- The encryption key lives only in `ombra.toml` — never exposed via the API

---

## Hardware targets

Ombra auto-detects your hardware at startup and selects the right model. No manual configuration needed.

| Profile | Hardware | Model | RAM |
|---|---|---|---|
| **Performance** | x86_64 with ≥ 32 GB RAM | Gemma-2-9B Q8_0 | ~9.8 GB |
| **Efficiency** | Intel N100 / N305, x86_64 with 8–16 GB | Gemma-2-2B Q8_0 | ~2.8 GB |
| **Edge** | Raspberry Pi 4B / 5, ARM64 | Gemma-2-2B Q4_K_M | ~1.6 GB |

Embedding model: `nomic-embed-text-v1.5` (runs on all profiles via `fastembed`).

---

## Crates

| Crate | Role |
|---|---|
| `ombra-server` | Axum HTTP/WebSocket server, mTLS, ingestion pipeline |
| `ombra-ai` | llama.cpp inference, fastembed embeddings, Qdrant vector store, language detection |
| `ombra-common` | Shared types, AES-256-GCM encryption, hardware detection, config |
| `ombra-cli` | Ratatui TUI dashboard, installer *(in progress)* |

---

## Requirements

- [Rust](https://rustup.rs/) (stable)
- [Docker](https://docs.docker.com/get-docker/) — for Qdrant
- `curl`
- Ubuntu Server 24.04 LTS (x86_64 or ARM64)

---

## Setup

```bash
git clone https://github.com/your-username/ombra-backend.git
cd ombra-backend
bash setup.sh
```

`setup.sh` handles everything:

- Installs system dependencies
- Starts the Qdrant container
- Generates mTLS certificates (CA, server, client)
- Detects your hardware and downloads the correct GGUF model
- Builds the release binary

---

## Run

```bash
./target/release/ombra-server
```

---

## API

All endpoints require a valid mTLS client certificate. See [docs/api.md](docs/api.md) for the full reference.

```bash
# Base flags for every request
CURL="curl --cert certs/client.crt --key certs/client.key --cacert certs/ca.crt"

$CURL https://localhost:3000/health
$CURL -X POST https://localhost:3000/query \
  -H "Content-Type: application/json" \
  -d '{"text": "What did I discuss with Lars?"}'
```

---

## Deploy guides

- [Intel N100 / N305 mini PC](docs/deploy-n100.md)
- [AMD Ryzen 8700G](docs/deploy-ryzen-8700g.md)
- [Raspberry Pi 4B](docs/deploy-rpi4b.md)

---

## Tech stack

![Tokio](https://img.shields.io/badge/Tokio-async-blueviolet?logo=rust&logoColor=white)
![Axum](https://img.shields.io/badge/Axum-HTTP%2FWS-blue?logo=rust&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-AES--256--GCM-003B57?logo=sqlite&logoColor=white)
![Qdrant](https://img.shields.io/badge/Qdrant-vector%20store-dc244c)
![llama.cpp](https://img.shields.io/badge/llama.cpp-local%20LLM-green)

---

## License

[MIT](LICENSE)
