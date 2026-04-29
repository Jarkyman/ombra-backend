# Deploying Ombra on Raspberry Pi 4B

| RAM | Chip code | Hardware profile | Model |
|-----|-----------|-----------------|-------|
| 1 GB | SEC928 | — (not supported) | — |
| 2 GB | D9WHZ / SEC940 | — (not supported) | — |
| 4 GB | D9WHV | Edge (auto-detected) | Gemma-2-2B Q4_K_M (~1.6 GB) |
| 8 GB | D9ZCL | Edge (auto-detected) | Gemma-2-2B Q4_K_M (~1.6 GB) |

**Requires 4 GB or 8 GB.** The 1 GB and 2 GB models do not have enough RAM to run the server.

## What you need

- Raspberry Pi 4B **4 GB or 8 GB** (see table above)
- MicroSD card, 32 GB minimum (64 GB+ for long-term use)
- Power supply: official 15W USB-C
- Ethernet cable (recommended during setup — Wi-Fi works but is slower for the model download)

## 1. Flash Ubuntu Server

Download **Ubuntu Server 24.04 LTS (64-bit)** for Raspberry Pi from ubuntu.com/download/raspberry-pi.

Flash to SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/) or `dd`. In Raspberry Pi Imager, use the gear icon to pre-configure:
- Hostname: `ombra`
- SSH: enabled
- Username + password

### user-data file

The packages below are also installed by the Ombra setup script — pre-installing them here speeds up setup.

```yaml
#cloud-config
manage_resolv_conf: false

hostname: ombra
manage_etc_hosts: true
package_update: true
packages:
- avahi-daemon      # ombra.local mDNS resolution on the local network
- git               # required by the Ombra installer
- curl              # required by the Ombra installer
- ca-certificates   # HTTPS access to Docker's apt repo
- gcc               # C compiler — required by the Rust linker
- g++               # C++ compiler — required by llama.cpp
- make              # build tool
- libc6-dev         # C standard library headers
- binutils          # linker tools
- pkg-config        # library linking during cargo build
- cmake             # llama-cpp-2 compiles llama.cpp from source
- qrencode          # QR code for app onboarding
apt:
  preserve_sources_list: true
  conf: |
    Acquire {
      Check-Date "false";
    };
timezone: America/Los_Angeles
keyboard:
  model: pc105
  layout: "en"
users:
- name: ombra
  groups: users,adm,dialout,audio,netdev,video,plugdev,cdrom,games,input,gpio,spi,i2c,render,sudo
  shell: /bin/bash
  lock_passwd: false
  passwd: "Ombra"
enable_ssh: true
ssh_pwauth: true
runcmd:
  - echo "gpu_mem=16" >> /boot/firmware/config.txt
```

## 2. Boot and connect

Insert the SD card, connect ethernet, power on. Find the IP on your router or use `ping ombra.local` once the Pi has booted. SSH in:

```bash
ssh ombra@ombra.local
# or
ssh ombra@<ip-address>
```

### Update packages

Before proceeding, update the system and reboot if there are kernel updates:

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

SSH back in after the reboot, then continue to step 3.

## 3. Run setup

```bash
curl -sSf https://get.ombra.io | bash
```

The installer will:
1. Install Docker (official apt repo, not snap) and Rust if not already present
2. Download Ombra to `~/ombra` and build the setup wizard
3. Launch an interactive terminal UI where you:
   - Choose your AI model (Edge profile auto-detected and recommended)
   - Set the response language
   - Optionally configure remote access via DuckDNS
4. Generate TLS certificates with your LAN IP in the SAN
5. Start Qdrant, download the model, and build the server in the background
6. Ask onboarding questions while everything runs — Ombra learns who you are before it's even finished
7. Install and enable the `ombra` systemd service so it starts automatically on boot

> **Build time:** 60–120 min. llama-cpp-2 compiles the full llama.cpp C++ library from source — this dominates the build time on ARM64. The onboarding questionnaire keeps you busy while it works.

## 4. Start the server

```bash
sudo systemctl start ombra
sudo systemctl status ombra
```

Health check (from the same machine):

```bash
curl --cacert ~/ombra/certs/ca.crt \
     --cert ~/ombra/certs/client.crt --key ~/ombra/certs/client.key \
     https://localhost:8080/health
```

## 5. Connect the mobile app

Run the QR code script to display the connection QR code:

```bash
bash ~/ombra/show-qr.sh
```

Scan with the Ombra app. Alternatively, copy these three files to your phone manually:

```
~/ombra/certs/client.crt
~/ombra/certs/client.key
~/ombra/certs/ca.crt
```

The app connects to `ombra.local:8080` on your home network. If you set up DuckDNS during setup, it falls back to `<subdomain>.duckdns.org:8080` elsewhere.

## Notes

- **Storage:** model (~1.6 GB) + OS + DB fits on 32 GB. 64 GB is more comfortable for long-term use.
- **Hardware detection:** `uname -m` returns `aarch64`, RAM ≥ 3 GB → Edge profile auto-selected.
- **Re-running setup:** Running `curl -sSf https://get.ombra.io | bash` again will pull the latest code and re-run the wizard. Existing config and certs are not overwritten.
