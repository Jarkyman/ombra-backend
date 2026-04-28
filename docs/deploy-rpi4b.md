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

```yaml
#cloud-config
manage_resolv_conf: false

hostname: ombra
manage_etc_hosts: true
package_update: true
packages:
- avahi-daemon      # ombra.local mDNS resolution on the local network
- git               # clone the repo
- curl              # Rust installer + Docker apt repo setup
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

Clone the repo and run the wizard:

```bash
git clone https://github.com/Jarkyman/ombra-backend.git
cd ombra-backend
bash setup.sh
```

Setup will:
1. Install Docker (official apt repo, not snap) and Rust automatically
2. Ask: language → model → Standard/Advanced → remote access (optional)
3. Generate TLS certificates with your LAN IP in the SAN
4. Download the model in the background (Edge profile auto-detected)
5. Build the server in the background (`cargo build --release` — 60–120 min, llama.cpp compiles from source)
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

- **Build time:** 60–120 min. llama-cpp-2 compiles the full llama.cpp C++ library from source — this dominates the build time on ARM64.
- **Storage:** model (~1.6 GB) + OS + DB fits on 32 GB. 64 GB is more comfortable for long-term use.
- **Hardware detection:** `uname -m` returns `aarch64`, RAM ≥ 3 GB → Edge profile auto-selected.
