# Deploying Ombra on Raspberry Pi 4B

**Hardware profile:** Edge — Gemma-2-2B Q4_K_M (~1.6 GB)  
**Recommended hardware:** Raspberry Pi 4B 8GB

## What you need

- Raspberry Pi 4B (8GB recommended; 4GB works but is tight during build)
- MicroSD card, 32 GB minimum (64 GB+ for long-term use)
- Power supply: official 15W USB-C
- Ethernet cable (recommended during setup — Wi-Fi works but is slower for the model download)

## 1. Flash Ubuntu Server

Download **Ubuntu Server 24.04 LTS (64-bit)** for Raspberry Pi from ubuntu.com/download/raspberry-pi.

Flash to SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/) or `dd`. In Raspberry Pi Imager, use the gear icon to pre-configure:
- Hostname: `ombra`
- SSH: enabled
- Username + password

## 2. Boot and connect

Insert the SD card, connect ethernet, power on. Find the IP on your router or scan with `nmap -sn 192.168.1.0/24`. SSH in:

```bash
ssh <your-user>@ombra.local
# or
ssh <your-user>@<ip-address>
```

## 3. Run setup

Clone the repo and run the wizard:

```bash
git clone https://github.com/your-org/ombra.git
cd ombra/ombra-backend
bash setup.sh
```

Setup will:
1. Install Docker (official apt repo, not snap) and Rust automatically
2. Ask: language → model → Standard/Advanced → remote access (optional)
3. Generate TLS certificates with your LAN IP in the SAN
4. Download Gemma-2-2B Q4_K_M in the background (auto-detected for ARM64)
5. Build the server in the background (`cargo build --release` — takes 10–20 min on Pi)
6. Run the onboarding questionnaire while everything compiles
7. Install and enable the `ombra` systemd service

## 4. Start the server

```bash
sudo systemctl start ombra
sudo systemctl status ombra
```

Health check (from the same machine):

```bash
curl --cacert certs/ca.crt \
     --cert certs/client.crt --key certs/client.key \
     https://localhost:8080/health
```

## 5. Connect the mobile app

Copy these three files to your phone via AirDrop, email, or scp:

```
certs/client.crt
certs/client.key
certs/ca.crt
```

The app connects to `ombra.local:8080` on your home network. If you set up DuckDNS during setup, it falls back to `<subdomain>.duckdns.org:8080` elsewhere.

## Notes

- **Build time:** first `cargo build --release` takes 10–20 minutes on the Pi. Subsequent builds are faster.
- **Storage:** model (~1.6 GB) + OS + DB fits comfortably on 32 GB. For a machine you intend to run long-term, 64 GB is more comfortable.
- **Memory during build:** the linker uses ~3 GB RAM. On a 4 GB Pi this may cause the build to be killed by the OOM killer. If that happens, add swap: `sudo dphys-swapfile swapoff && sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile && sudo dphys-swapfile setup && sudo dphys-swapfile swapon`
- **Hardware detection:** `uname -m` returns `aarch64` → Edge profile is auto-selected → Q4_K_M model.
