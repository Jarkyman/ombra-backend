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

**2. Install Docker Desktop for Windows** from docker.com. During install, make sure "Use WSL2 based engine" is checked. After install, go to Settings → Resources → WSL Integration and enable it for Ubuntu-24.04.

**3. Clone Ombra:**

```bash
git clone https://github.com/Jarkyman/ombra-backend.git
cd ombra-backend
```

**4. Run setup:**

```bash
bash setup.sh
```

Setup detects x86_64 + 32 GB RAM → recommends **Performance** profile (Gemma-2-9B Q8_0).

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

## Notes

- Files inside WSL2 (`~/`) are separate from Windows files (`C:\`). Access Windows files from WSL2 via `/mnt/c/`.
- The model (~9.8 GB) is stored inside the WSL2 environment. `wsl --unregister` removes it along with everything else.
- WSL2 shares RAM with Windows dynamically — with 32 GB total, running the 9B model leaves plenty of headroom.
