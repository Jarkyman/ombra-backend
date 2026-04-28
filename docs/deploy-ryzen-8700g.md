# Deploying Ombra on AMD Ryzen 7 8700G

**Hardware profile:** Performance — Gemma-2-9B Q8_0 (~9.8 GB)  
**Target hardware:** AMD Ryzen 7 8700G mini PC (e.g., Minisforum UM890 Pro, Beelink SER8)

## What you need

- Mini PC with Ryzen 7 8700G and at least 32 GB RAM
- SSD: 50 GB minimum free space (OS + model + DB + build artifacts)
- Ethernet connection recommended during setup

> The 8700G has an integrated Radeon 780M GPU. Ombra currently uses CPU inference only — GPU acceleration is a future improvement. The 32 GB RAM is what triggers the Performance profile.

## 1. Install Ubuntu Server

Download **Ubuntu Server 24.04 LTS (x86_64)** from ubuntu.com/download/server.

Flash to a USB stick with [balenaEtcher](https://etcher.balena.io/) and install. During install:
- Hostname: `ombra`
- Enable OpenSSH server
- Full disk install on SSD

## 2. Update packages

Before running setup, update the system and reboot if there are kernel updates:

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

SSH back in after the reboot, then continue.

## 3. Run setup

SSH in or open a terminal directly:

```bash
git clone https://github.com/Jarkyman/ombra-backend.git
cd ombra-backend
bash setup.sh
```

Setup will:
1. Install Docker (official apt repo) and Rust automatically
2. Detect x86_64 + ≥32 GB RAM → recommend **Performance** profile
3. Ask: language → model → Standard/Advanced → remote access (optional)
4. Download Gemma-2-9B Q8_0 in the background (~9.8 GB — takes a few minutes on a fast connection)
5. Build the server in the background (`cargo build --release` — 10–20 min, llama.cpp compiles from source)
6. Run the onboarding questionnaire while everything builds
7. Install and enable the `ombra` systemd service
8. Show a QR code to connect the mobile app

## 4. Start the server

```bash
sudo systemctl start ombra
sudo systemctl status ombra
```

Health check:

```bash
curl --cacert certs/ca.crt \
     --cert certs/client.crt --key certs/client.key \
     https://ombra.local:8080/health
```

## 5. Connect the mobile app

Scan the QR code shown at the end of setup with the Ombra app. To show it again:

```bash
bash show-qr.sh
```

The app connects to `ombra.local:8080` locally. With DuckDNS configured, `<subdomain>.duckdns.org:8080` works from anywhere.

## Notes

- **Build time:** 10–20 min. llama-cpp-2 compiles the full llama.cpp C++ library from source — this dominates the build time.
- **Model size:** Gemma-2-9B Q8_0 is ~9.8 GB on disk and loads ~9.8 GB into RAM. With 32 GB total, this leaves ~22 GB for OS, build artifacts, and headroom — comfortable.
- **Response quality:** This is the highest-quality profile. Responses are noticeably richer than the 2B model.
- **Inference speed:** Ryzen 7 8700G has 16 threads. Expect 15–30 tokens/sec for the 9B model, which is fast enough for real-time query responses.
- **Power:** The 8700G idles at ~10–15W, full load ~45–65W. Suitable for always-on home server use.
