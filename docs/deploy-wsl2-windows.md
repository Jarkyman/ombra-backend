# Deploying Ombra on Windows via WSL2

**Hardware profile:** Performance — Gemma-2-9B Q8_0 (~9.8 GB)  
**Target hardware:** AMD Ryzen with 32 GB RAM

WSL2 runs Ubuntu natively inside Windows with near-native performance. No ISO, no VM overhead.

## Install

**1. Open PowerShell as Administrator and run:**

```powershell
wsl --install -d Ubuntu-24.04
```

Restart when prompted. After reboot, Ubuntu opens automatically — set a username and password.

**2. Install Docker Desktop for Windows:**

- Download from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
- Run the installer — when asked, choose **"Use WSL2 based engine"** (should be default)
- After install, open Docker Desktop and go to: **Settings → Resources → WSL Integration**
- Enable the toggle for **Ubuntu-24.04** — this lets Docker Desktop communicate with your WSL2 environment
- Click **Apply & Restart**

Docker Desktop must be running (visible in the system tray) whenever you use Ombra.

**3. Open the WSL2 terminal:**

Search for **Ubuntu** in the Windows Start menu and open it. This is your Linux terminal — all following commands run here.

**4. Clone Ombra and run setup:**

Make sure you are in the Linux home directory — not on the Windows filesystem (`/mnt/c/...`).

```bash
cd ~
git clone https://github.com/Jarkyman/ombra-backend.git
cd ombra-backend
bash setup.sh
```

**5. Start the server** (WSL2 has no systemd by default — run directly):

```bash
cd ~/ombra-backend
./target/release/ombra-server
```

Or in the background:

```bash
nohup ./target/release/ombra-server > ombra.log 2>&1 &
tail -f ombra.log
```

**6. Health check:**

```bash
curl --cacert certs/ca.crt \
     --cert certs/client.crt --key certs/client.key \
     https://localhost:8080/health
```

## Uninstall (complete removal)

**Remove the Ubuntu distro and all its files:**

```powershell
# In PowerShell as Administrator
wsl --unregister Ubuntu-24.04
```

This deletes the entire Ubuntu environment including all files inside it. Your Windows files are untouched.

**Verify it's gone:**

```powershell
wsl --list
```

**Optional — uninstall WSL2 entirely:**

Go to Windows Settings → Apps → Installed apps → search "Windows Subsystem for Linux" → Uninstall.

**Optional — uninstall Docker Desktop:**

Settings → Apps → Docker Desktop → Uninstall.

## Troubleshooting

**`error: chmod on /mnt/c/... failed: Operation not permitted`** during git clone  
You are cloning into the Windows filesystem. Run `cd ~` first and clone into the Linux home directory instead.

**`Command 'cargo' not found`** after setup  
Rust was installed but PATH is not updated in the current session. Run `source ~/.cargo/env` and try again.

**`Docker daemon is not running`**  
Docker Desktop is not started. Open it from the Windows Start menu and wait for it to finish loading (the system tray icon stops animating), then try again.

**Docker Desktop is open but setup still says daemon is not running**  
WSL integration is not enabled. In Docker Desktop: **Settings → Resources → WSL Integration** → enable the toggle for **Ubuntu-24.04** → click **Apply & Restart**. Then try setup again.

**`Failed to start ombra.service: Unit docker.service not found`**  
Do not use `sudo systemctl start ombra` on WSL2 — the systemd service is only installed on native Linux. Run the server directly instead: `./target/release/ombra-server` (see step 5).

**`docker: permission denied`**  
Your user is not yet in the docker group for this session. Run `newgrp docker` or close and reopen the Ubuntu terminal.

**Build takes a very long time**  
Normal on first run — `cargo build --release` compiles llama.cpp from source. Expect 5–10 minutes on a Ryzen. Subsequent builds are much faster.

## Notes

- Files inside WSL2 (`~/`) are separate from Windows files (`C:\`). Access Windows files from WSL2 via `/mnt/c/`.
- The model (~9.8 GB) is stored inside the WSL2 environment. `wsl --unregister` removes it along with everything else.
- WSL2 shares RAM with Windows dynamically — with 32 GB total, running the 9B model leaves plenty of headroom.
