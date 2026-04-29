# Deploying Ombra on Intel N100 / N305

**Hardware profile:** Efficiency — Gemma-2-2B Q8_0 (~2.8 GB)  
**Target hardware:** Intel N100 or N305 mini PC (e.g., Beelink EQ12, BMAX B4, Trigkey G4)

## What you need

- Mini PC with Intel N100 or N305 and 8–16 GB RAM
- SSD: 32 GB minimum free space
- Ethernet connection recommended during setup

> N100/N305 are low-power x86_64 chips (6–15W TDP) — ideal for always-on home servers. At 8–16 GB RAM, the hardware detector selects the Efficiency profile.

## 1. Install Ubuntu Server

Download **Ubuntu Server 24.04 LTS (x86_64)** from ubuntu.com/download/server.

Flash to a USB stick with [balenaEtcher](https://etcher.balena.io/) and install. During install:
- Hostname: `ombra`
- Enable OpenSSH server
- Full disk install on SSD/eMMC

## 2. Update packages

Before running setup, update the system and reboot if there are kernel updates:

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

SSH back in after the reboot, then continue.

## 3. Run setup

SSH in or open a terminal directly, then run:

```bash
curl -sSf https://raw.githubusercontent.com/Jarkyman/ombra-backend/main/install.sh | bash
```

The installer will:
1. Install Docker (official apt repo) and Rust if not already present
2. Download Ombra to `~/ombra` and build the setup wizard
3. Launch an interactive terminal UI where you:
   - Choose your AI model (Efficiency profile auto-detected and recommended)
   - Set the response language
   - Optionally configure remote access via DuckDNS
4. Generate TLS certificates with your LAN IP in the SAN
5. Start Qdrant, download Gemma-2-2B Q8_0 (~2.8 GB), and build the server in the background
6. Ask onboarding questions while everything runs
7. Install and enable the `ombra` systemd service so it starts automatically on boot

> **Build time:** 30–60 min on N100. llama-cpp-2 compiles the full llama.cpp C++ library from source — the N100's 4 low-power cores make this the bottleneck.

## 4. Start the server

```bash
sudo systemctl start ombra
sudo systemctl status ombra
```

Health check:

```bash
curl --cacert ~/ombra/certs/ca.crt \
     --cert ~/ombra/certs/client.crt --key ~/ombra/certs/client.key \
     https://ombra.local:8080/health
```

## 5. Connect the mobile app

Run the QR code script to display the connection QR code:

```bash
bash ~/ombra/show-qr.sh
```

Scan with the Ombra app. The app connects to `ombra.local:8080` locally. With DuckDNS configured, `<subdomain>.duckdns.org:8080` works from anywhere.

## Notes

- **Model size:** Gemma-2-2B Q8_0 is ~2.8 GB on disk and in RAM. Leaves plenty of headroom on 8 GB.
- **N100 vs N305:** The N305 has slightly higher base clock and power limit. Both work identically — the same Efficiency profile is selected.
- **Inference speed:** Expect 10–20 tokens/sec on the 2B model. Fast enough for query responses in under a few seconds.
- **Power:** N100 idles at 4–6W. One of the most power-efficient options for an always-on server — cheaper to run than a light bulb.
- **eMMC vs SSD:** Many N100 mini PCs ship with eMMC storage. Builds and model loading are noticeably faster on an NVMe SSD. Worth the upgrade for a permanent setup.
- **16 GB RAM:** If your N100 device has 16 GB, the hardware detector still selects Efficiency (threshold is 28 GB for Performance). You can manually select Performance in setup if you want to run the 9B model, but inference will be slower than on the 8700G.
- **Re-running setup:** Running `curl -sSf https://raw.githubusercontent.com/Jarkyman/ombra-backend/main/install.sh | bash` again will pull the latest code and re-run the wizard. Existing config and certs are not overwritten.
