#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/models"
CERTS_DIR="$SCRIPT_DIR/certs"
CONFIG_FILE="$SCRIPT_DIR/ombra.toml"
PROFILE_FILE="$SCRIPT_DIR/user_profile.toml"
STATUS_DIR="/tmp/ombra_setup_$$"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

FLAG_QDRANT="$STATUS_DIR/qdrant_ready"
FLAG_DOWNLOAD="$STATUS_DIR/model_done"
FLAG_BUILD="$STATUS_DIR/build_done"
FLAG_DONE="$STATUS_DIR/all_done"
FLAG_ERROR="$STATUS_DIR/error"

SELECTED_PROFILE=""
SELECTED_MODEL_FILENAME=""
SELECTED_MODEL_REPO=""
CONFIG_LANGUAGE=""
DDNS_TOKEN=""
DDNS_SUBDOMAIN=""
SKIP_QUESTIONNAIRE=false
DOCKER_CMD="docker"

info()    { echo -e "${GREEN}[+]${NC} $1"; }
warning() { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[x]${NC} $1"; exit 1; }

cleanup() {
    rm -rf "$STATUS_DIR"
    kill "$(jobs -p)" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$STATUS_DIR"

# ── Banner ────────────────────────────────────────────────────────────────────

print_banner() {
    clear
    echo ""
    echo -e "${BOLD}  Ombra${NC}"
    echo -e "${DIM}  Self-Hosted Personal Memory — Setup Wizard${NC}"
    echo ""
    echo -e "  ${DIM}Everything runs on your own hardware.${NC}"
    echo -e "  ${DIM}Your data never leaves your home.${NC}"
    echo ""
}

# ── Dependencies ──────────────────────────────────────────────────────────────

install_docker() {
    if command -v docker >/dev/null 2>&1; then return; fi

    echo ""
    info "Installing Docker..."

    if [[ "$(uname)" == "Darwin" ]]; then
        echo -e "  ${RED}Docker Desktop for Mac must be installed manually.${NC}"
        echo -e "  ${DIM}https://docs.docker.com/desktop/install/mac-install/${NC}"
        exit 1
    fi

    # Official Docker install via apt (not snap — snap version lacks compose plugin)
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq ca-certificates curl gnupg

    $SUDO install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    $SUDO chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/ubuntu \
        $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        | $SUDO tee /etc/apt/sources.list.d/docker.list > /dev/null

    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq \
        docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin

    $SUDO usermod -aG docker "$USER"
    $SUDO systemctl enable docker
    $SUDO systemctl start  docker

    # Group membership requires re-login — use sudo docker for this session
    DOCKER_CMD="sudo docker"

    info "Docker installed."
}

install_rust() {
    if command -v cargo >/dev/null 2>&1; then return; fi

    echo ""
    info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --default-toolchain stable \
        >> "$STATUS_DIR/rust_install.log" 2>&1

    # shellcheck source=/dev/null
    source "$HOME/.cargo/env"

    info "Rust installed ($(cargo --version))."
}

install_build_tools() {
    if [[ "$(uname)" == "Darwin" ]]; then
        if ! command -v cmake >/dev/null 2>&1; then
            if command -v brew >/dev/null 2>&1; then
                info "Installing cmake..."
                brew install cmake > /dev/null 2>&1
            else
                echo -e "  ${RED}cmake is required but Homebrew is not installed.${NC}"
                echo -e "  ${DIM}Install Homebrew: https://brew.sh, then re-run setup.${NC}"
                exit 1
            fi
        fi
        if ! xcode-select -p >/dev/null 2>&1; then
            info "Installing Xcode Command Line Tools..."
            xcode-select --install
            echo "  Re-run setup after the Xcode CLT install completes."
            exit 0
        fi
        return
    fi

    info "Installing build tools..."
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq \
        gcc g++ make libc6-dev binutils pkg-config libssl-dev cmake curl openssl \
        clang libclang-dev qrencode
}

check_dependencies() {
    install_build_tools
    install_docker
    install_rust

    if ! $DOCKER_CMD info >/dev/null 2>&1; then
        if [[ "$(uname)" == "Darwin" ]]; then
            error "Docker is not running. Open Docker Desktop and try again."
        elif grep -qi microsoft /proc/version 2>/dev/null; then
            error "Docker is not running. Open Docker Desktop on Windows and make sure WSL integration is enabled for this distro (Docker Desktop → Settings → Resources → WSL Integration)."
        else
            info "Starting Docker..."
            $SUDO systemctl start docker 2>/dev/null \
                || $SUDO service docker start 2>/dev/null \
                || error "Could not start Docker. Run: sudo systemctl start docker"
            sleep 2
        fi
    fi

    info "Dependencies OK"
}

# ── Hardware detection ────────────────────────────────────────────────────────

detect_hardware_profile() {
    local arch
    arch="$(uname -m)"
    local ram_gb
    if [[ "$(uname)" == "Darwin" ]]; then
        ram_gb=$(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
    else
        ram_gb=$(( $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024 ))
    fi
    if [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        (( ram_gb < 3 )) && echo "Nano" || echo "Edge"
        return
    fi
    (( ram_gb >= 28 )) && echo "Performance" || echo "Efficiency"
}

# ── Model selection ───────────────────────────────────────────────────────────

model_info() {
    case "$1" in
        Performance) echo "bartowski/gemma-2-9b-it-GGUF gemma-2-9b-it-Q8_0.gguf" ;;
        Efficiency)  echo "bartowski/gemma-2-2b-it-GGUF gemma-2-2b-it-Q8_0.gguf" ;;
        Edge)        echo "bartowski/gemma-2-2b-it-GGUF gemma-2-2b-it-Q4_K_M.gguf" ;;
        Nano)        echo "bartowski/Qwen2.5-1.5B-Instruct-GGUF Qwen2.5-1.5B-Instruct-Q4_K_M.gguf" ;;
    esac
}

select_model() {
    local recommended
    recommended="$(detect_hardware_profile)"

    echo ""
    echo -e "${BOLD}  Select AI model${NC}"
    echo ""
    echo -e "  ${DIM}Detected hardware: $(uname -m)${NC}"
    echo ""
    printf "  %-4s %-14s %-32s %s\n" "No." "Profile" "Model" "Size"
    echo "  ────────────────────────────────────────────────────────────────"

    local profiles=("Nano" "Edge" "Efficiency" "Performance")
    local labels=("Nano        — Qwen2.5-1.5B Q4_K_M (fits in 2 GB RAM)" \
                  "Edge        — Gemma-2-2B Q4_K_M   (ARM-optimised, 4+ GB RAM)" \
                  "Efficiency  — Gemma-2-2B Q8_0     (balanced)" \
                  "Performance — Gemma-2-9B Q8_0     (best quality, needs 16+ GB RAM)")
    local sizes=("~1.0 GB" "~1.6 GB" "~2.8 GB" "~9.8 GB")
    local default_num=1

    for i in "${!profiles[@]}"; do
        local num=$(( i + 1 ))
        local rec=""
        [[ "${profiles[$i]}" == "$recommended" ]] && rec="${GREEN} ← recommended${NC}" && default_num=$num
        echo -e "  ${BOLD}${num}${NC}. ${labels[$i]}  ${DIM}${sizes[$i]}${NC}${rec}"
    done

    echo ""
    echo -e -n "  Select [${default_num}]: "
    read -r model_choice
    model_choice="${model_choice:-$default_num}"

    case "$model_choice" in
        1) SELECTED_PROFILE="Nano" ;;
        2) SELECTED_PROFILE="Edge" ;;
        3) SELECTED_PROFILE="Efficiency" ;;
        4) SELECTED_PROFILE="Performance" ;;
        *) SELECTED_PROFILE="${profiles[$(( default_num - 1 ))]}" ;;
    esac

    read -r SELECTED_MODEL_REPO SELECTED_MODEL_FILENAME <<< "$(model_info "$SELECTED_PROFILE")"
    info "Model: $SELECTED_MODEL_FILENAME"
}

# ── Setup mode selection ──────────────────────────────────────────────────────

select_setup_mode() {
    echo ""
    echo -e "${BOLD}  Setup mode${NC}"
    echo ""
    echo "  1. Standard  — recommended defaults, guided remote access setup"
    echo "  2. Advanced  — same as standard, but with manual options"
    echo ""
    echo -e -n "  Select [1]: "
    read -r mode_choice
    mode_choice="${mode_choice:-1}"
    echo ""
}

# ── Language ──────────────────────────────────────────────────────────────────

ask_language() {
    echo ""
    echo -e "${BOLD}  Response language${NC}"
    echo -e "  ${DIM}Which language should Ombra respond in?${NC}"
    echo ""
    echo -e -n "  ISO 639-1 code (e.g. en, da, de, fr) [en]: "
    read -r CONFIG_LANGUAGE
    CONFIG_LANGUAGE="${CONFIG_LANGUAGE:-en}"
    info "Language: $CONFIG_LANGUAGE"
}

# ── Remote access (DuckDNS) ───────────────────────────────────────────────────

ask_remote_access() {
    echo ""
    echo -e "${BOLD}  Remote access${NC}"
    echo -e "  ${DIM}Access Ombra from anywhere — not just your home network.${NC}"
    echo -e "  ${DIM}Uses DuckDNS (free). Requires a one-time port-forward in your router.${NC}"
    echo ""
    echo -e -n "  Set up remote access? [y/N]: "
    read -r setup_ddns

    local setup_ddns_lc
    setup_ddns_lc="$(echo "$setup_ddns" | tr '[:upper:]' '[:lower:]')"
    if [[ "$setup_ddns_lc" == "y" || "$setup_ddns_lc" == "yes" ]]; then
        echo ""
        echo -e "  ${DIM}1. Go to https://www.duckdns.org and sign in${NC}"
        echo -e "  ${DIM}2. Create a subdomain (e.g. 'my-ombra')${NC}"
        echo -e "  ${DIM}3. Copy your token from the top of the page${NC}"
        echo ""
        echo -e -n "  DuckDNS token: "
        read -r DDNS_TOKEN
        echo -e -n "  Subdomain name (e.g. 'my-ombra'): "
        read -r DDNS_SUBDOMAIN

        if [[ -n "$DDNS_TOKEN" && -n "$DDNS_SUBDOMAIN" ]]; then
            info "Remote access: ${DDNS_SUBDOMAIN}.duckdns.org"
        else
            warning "Incomplete — skipping remote access."
            DDNS_TOKEN=""; DDNS_SUBDOMAIN=""
        fi
    else
        info "Skipping remote access. Add [ddns] to ombra.toml later to enable."
    fi
}

# ── Write config ──────────────────────────────────────────────────────────────

write_config() {
    [[ -f "$CONFIG_FILE" ]] && { info "Config exists — skipping."; return; }

    local encryption_key
    encryption_key="$(openssl rand -hex 32)"

    local old_umask
    old_umask="$(umask)"
    umask 077

    {
        printf 'server_port = 8080\n'
        printf 'database_path = "ombra.db"\n'
        printf 'qdrant_url = "http://localhost:6334"\n'
        printf 'models_directory = "models"\n'
        printf 'response_language = "%s"\n' "$CONFIG_LANGUAGE"
        printf 'hardware_profile = "%s"\n' "$SELECTED_PROFILE"
        printf 'profile_encounter_threshold = 5\n'
        printf 'cluster_timeout_minutes = 5\n'
        printf 'tls_server_cert_path = "certs/server.crt"\n'
        printf 'tls_server_key_path = "certs/server.key"\n'
        printf 'tls_client_ca_cert_path = "certs/client-ca.crt"\n'
        printf 'encryption_key = "%s"\n' "$encryption_key"
    } > "$CONFIG_FILE"

    if [[ -n "$DDNS_TOKEN" && -n "$DDNS_SUBDOMAIN" ]]; then
        printf '\n[ddns]\nprovider = "duck_dns"\ntoken = "%s"\nsubdomain = "%s"\n' \
            "$DDNS_TOKEN" "$DDNS_SUBDOMAIN" >> "$CONFIG_FILE"
    fi

    umask "$old_umask"
    info "Config written."
}

# ── Certificates ──────────────────────────────────────────────────────────────

detect_server_ip() {
    if [[ "$(uname)" == "Darwin" ]]; then
        ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo ""
    else
        ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo ""
    fi
}

generate_certificates() {
    [[ -f "$CERTS_DIR/server.crt" && -f "$CERTS_DIR/client.crt" ]] && { info "Certificates exist."; return; }

    local server_ip
    server_ip="$(detect_server_ip)"

    if [[ -n "$server_ip" ]]; then
        bash "$SCRIPT_DIR/scripts/generate_dev_certs.sh" --server-ip "$server_ip" > /dev/null
    else
        bash "$SCRIPT_DIR/scripts/generate_dev_certs.sh" > /dev/null
    fi
    info "Certificates generated."
}

# ── mDNS ─────────────────────────────────────────────────────────────────────

setup_mdns() {
    [[ "$(uname)" == "Darwin" ]] && return

    if ! command -v avahi-daemon >/dev/null 2>&1; then
        $SUDO apt-get install -y avahi-daemon > /dev/null 2>&1 \
            || { warning "avahi-daemon install failed — ombra.local unavailable."; return; }
    fi

    $SUDO systemctl enable avahi-daemon > /dev/null 2>&1 || true
    $SUDO systemctl start  avahi-daemon > /dev/null 2>&1 || true

    if [[ "$(hostname)" != "ombra" ]]; then
        echo ""
        echo -e -n "  Set hostname to 'ombra' (server accessible as ombra.local)? [Y/n]: "
        read -r set_hostname
        local set_hostname_lc
        set_hostname_lc="$(echo "$set_hostname" | tr '[:upper:]' '[:lower:]')"
        if [[ "$set_hostname_lc" != "n" && "$set_hostname_lc" != "no" ]]; then
            $SUDO hostnamectl set-hostname ombra
            info "Hostname set to 'ombra'."
        fi
    fi
}

# ── Background: Qdrant ────────────────────────────────────────────────────────

start_qdrant_background() {
    $DOCKER_CMD compose -f "$SCRIPT_DIR/docker-compose.yml" up -d >> "$STATUS_DIR/qdrant.log" 2>&1
    local attempts=0
    until curl -sf http://localhost:6333/healthz > /dev/null 2>&1; do
        attempts=$(( attempts + 1 ))
        (( attempts >= 60 )) && { printf 'Qdrant timed out\n' > "$FLAG_ERROR"; return; }
        sleep 1
    done
    touch "$FLAG_QDRANT"
}

# ── Background: Model download ────────────────────────────────────────────────

download_model_background() {
    local model_path="$MODELS_DIR/$SELECTED_MODEL_FILENAME"
    mkdir -p "$MODELS_DIR"

    if [[ -f "$model_path" ]]; then
        touch "$FLAG_DOWNLOAD"; return
    fi

    local url="https://huggingface.co/${SELECTED_MODEL_REPO}/resolve/main/${SELECTED_MODEL_FILENAME}"
    if curl -L -o "$model_path" "$url" >> "$STATUS_DIR/download.log" 2>&1; then
        touch "$FLAG_DOWNLOAD"
    else
        rm -f "$model_path"
        printf 'Model download failed\n' > "$FLAG_ERROR"
    fi
}

# ── Background: Build ─────────────────────────────────────────────────────────

build_server_background() {
    if cargo build --release -p ombra-server \
        --manifest-path "$SCRIPT_DIR/Cargo.toml" \
        >> "$STATUS_DIR/build.log" 2>&1; then
        touch "$FLAG_BUILD"
    else
        printf 'Build failed — see /tmp/ombra_setup_*/build.log\n' > "$FLAG_ERROR"
    fi
}

# ── Background: Finalize (runs after build is done) ───────────────────────────

finalize_background() {
    # Wait for build to complete
    while [[ ! -f "$FLAG_BUILD" ]]; do
        [[ -f "$FLAG_ERROR" ]] && return
        sleep 5
    done

    # Install systemd service (not on macOS or WSL2 — Docker Desktop manages the daemon there)
    local is_wsl=false
    grep -qi microsoft /proc/version 2>/dev/null && is_wsl=true

    if [[ "$(uname)" != "Darwin" ]] && [[ "$is_wsl" == "false" ]] && command -v systemctl > /dev/null 2>&1; then
        local service_file="/etc/systemd/system/ombra.service"
        local binary="$SCRIPT_DIR/target/release/ombra-server"
        $SUDO tee "$service_file" > /dev/null << SVCEOF
[Unit]
Description=Ombra Personal Memory Server
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=${USER}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${binary}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF
        $SUDO systemctl daemon-reload >> "$STATUS_DIR/service.log" 2>&1 || true
        $SUDO systemctl enable ombra  >> "$STATUS_DIR/service.log" 2>&1 || true
    fi

    touch "$FLAG_DONE"
    printf '\007'  # Bell
}

# ── Status display ────────────────────────────────────────────────────────────

status_line() {
    local qdrant build download

    if   [[ -f "$FLAG_QDRANT"   ]]; then qdrant="${GREEN}Qdrant ready${NC}"
    else qdrant="${YELLOW}Starting Qdrant${NC}"; fi

    if   [[ -f "$FLAG_DOWNLOAD" ]]; then download="${GREEN}Model ready${NC}"
    else download="${YELLOW}Downloading model${NC}"; fi

    if   [[ -f "$FLAG_BUILD"    ]]; then build="${GREEN}Server built${NC}"
    else build="${YELLOW}Building server${NC}"; fi

    echo -e "  ${DIM}[ $qdrant  |  $download  |  $build ]${NC}"
}

progress_bar() {
    local pct=5
    [[ -f "$FLAG_QDRANT"   ]] && pct=$(( pct + 10 ))
    [[ -f "$FLAG_DOWNLOAD" ]] && pct=$(( pct + 45 ))
    [[ -f "$FLAG_BUILD"    ]] && pct=$(( pct + 35 ))
    [[ -f "$FLAG_DONE"     ]] && pct=100

    local filled=$(( pct / 5 ))
    local empty=$(( 20 - filled ))
    local bar=""
    local i
    for (( i=0; i<filled; i++ )); do bar="${bar}█"; done
    for (( i=0; i<empty;  i++ )); do bar="${bar}░"; done

    local label
    if   [[ -f "$FLAG_DONE"     ]]; then label="Ready"
    elif [[ -f "$FLAG_BUILD"    ]]; then label="Installing service..."
    elif [[ -f "$FLAG_DOWNLOAD" ]]; then label="Building server..."
    elif [[ -f "$FLAG_QDRANT"   ]]; then label="Downloading model..."
    else label="Starting..."; fi

    printf "\r  [%s] %3d%%  %s          " "$bar" "$pct" "$label"
}

# ── Onboarding questionnaire ──────────────────────────────────────────────────

PROFILE_NAME=""
PROFILE_OCCUPATION=""
PROFILE_LOCATION=""
PROFILE_IMPORTANT_PEOPLE=""
PROFILE_CURRENT_PROJECTS=""
PROFILE_ADDITIONAL=""

ask_onboarding_question() {
    local varname="$1"
    local question="$2"

    echo ""
    status_line
    echo ""
    echo -e "  ${CYAN}${question}${NC}"
    echo -e -n "  > "
    read -r answer

    local answer_lc
    answer_lc="$(echo "$answer" | tr '[:upper:]' '[:lower:]')"
    if [[ "$answer_lc" == "done" ]]; then
        SKIP_QUESTIONNAIRE=true
        return
    fi

    eval "${varname}=\"\$answer\""
}

run_onboarding() {
    echo ""
    echo ""
    echo -e "${BOLD}  While your server is being set up...${NC}"
    echo ""
    echo -e "  ${DIM}Answer a few questions so Ombra knows who you are.${NC}"
    echo -e "  ${DIM}Press Enter to skip any question. Type 'done' to skip the rest.${NC}"
    echo ""

    ask_onboarding_question PROFILE_NAME             "What is your name?"
    $SKIP_QUESTIONNAIRE && save_profile && return

    ask_onboarding_question PROFILE_OCCUPATION       "What do you do for work?"
    $SKIP_QUESTIONNAIRE && save_profile && return

    ask_onboarding_question PROFILE_LOCATION         "Where are you based?"
    $SKIP_QUESTIONNAIRE && save_profile && return

    ask_onboarding_question PROFILE_IMPORTANT_PEOPLE "Who are the most important people in your life?"
    $SKIP_QUESTIONNAIRE && save_profile && return

    ask_onboarding_question PROFILE_CURRENT_PROJECTS "What are you working on right now?"
    $SKIP_QUESTIONNAIRE && save_profile && return

    ask_onboarding_question PROFILE_ADDITIONAL       "Anything else you'd like Ombra to know about you?"

    save_profile
    echo ""
    info "Profile saved. Ombra will use this as context for every answer."
}

save_profile() {
    local timestamp
    timestamp="$(date +%s)"

    local old_umask
    old_umask="$(umask)"
    umask 077

    {
        printf '# Ombra user profile — collected at setup\n'
        printf '# Edit freely. The server reads this on first boot.\n\n'
        printf '[profile]\n'
        printf 'name = "%s"\n'             "$PROFILE_NAME"
        printf 'occupation = "%s"\n'       "$PROFILE_OCCUPATION"
        printf 'location = "%s"\n'         "$PROFILE_LOCATION"
        printf 'important_people = "%s"\n' "$PROFILE_IMPORTANT_PEOPLE"
        printf 'current_projects = "%s"\n' "$PROFILE_CURRENT_PROJECTS"
        printf 'additional = "%s"\n'       "$PROFILE_ADDITIONAL"
        printf 'created_at = %s\n'         "$timestamp"
    } > "$PROFILE_FILE"

    umask "$old_umask"
}

# ── Wait for completion ───────────────────────────────────────────────────────

wait_for_ready() {
    echo ""
    echo ""
    echo -e "${BOLD}  Setting up...${NC}"
    echo ""

    while [[ ! -f "$FLAG_DONE" ]]; do
        if [[ -f "$FLAG_ERROR" ]]; then
            echo ""
            error "Setup failed: $(cat "$FLAG_ERROR")"
        fi
        progress_bar
        sleep 2
    done

    progress_bar
    echo ""
    echo ""
    echo -e "  ${BOLD}${GREEN}Server is ready.${NC}"
    echo ""
}

# ── QR code ──────────────────────────────────────────────────────────────────

show_qr() {
    echo ""
    echo -e "${BOLD}  Connect the Ombra app:${NC}"
    echo ""
    echo "  1. Start the server:"
    local _is_wsl=false
    grep -qi microsoft /proc/version 2>/dev/null && _is_wsl=true
    if [[ "$(uname)" == "Darwin" ]] || [[ "$_is_wsl" == "true" ]]; then
        echo "     ./target/release/ombra-server"
    else
        echo "     sudo systemctl start ombra"
    fi
    echo ""
    echo "  2. Generate the connection QR code:"
    echo "     bash show-qr.sh"
    echo ""
    echo "  3. Scan with the Ombra app"
    echo ""
}

# ── Summary ───────────────────────────────────────────────────────────────────

print_summary() {
    local server_ip
    server_ip="$(detect_server_ip)"

    echo ""
    echo -e "${BOLD}  ────────────────────────────────────────────────${NC}"
    echo -e "${BOLD}  Ombra setup complete${NC}"
    echo -e "${BOLD}  ────────────────────────────────────────────────${NC}"
    echo ""
    local _is_wsl=false
    grep -qi microsoft /proc/version 2>/dev/null && _is_wsl=true

    if [[ "$(uname)" == "Darwin" ]] || [[ "$_is_wsl" == "true" ]]; then
        echo "  Start:"
        echo "    ./target/release/ombra-server"
        echo ""
        echo "  Or run in background:"
        echo "    nohup ./target/release/ombra-server > ombra.log 2>&1 &"
        echo "    tail -f ombra.log"
        echo ""
        echo "  Health check:"
        echo "    curl --cacert certs/ca.crt \\"
        echo "         --cert certs/client.crt --key certs/client.key \\"
        echo "         https://localhost:8080/health"
        echo ""
        echo "  Logs:  tail -f ombra.log"
    else
        echo "  Start:"
        echo "    sudo systemctl start ombra"
        echo ""
        echo "  Health check:"
        echo "    curl --cacert certs/ca.crt \\"
        echo "         --cert certs/client.crt --key certs/client.key \\"
        echo "         https://localhost:8080/health"
        echo ""
        echo "  Logs:  journalctl -u ombra -f"
    fi
    echo ""

    if [[ -n "$DDNS_TOKEN" && -n "$DDNS_SUBDOMAIN" ]]; then
        echo -e "  Remote: https://${DDNS_SUBDOMAIN}.duckdns.org:8080"
        echo ""
        echo -e "  ${YELLOW}ACTION REQUIRED — Router port forwarding:${NC}"
        echo "  Forward port 8080 (TCP) to this machine."
        if [[ -n "$server_ip" ]]; then
            echo "  This machine's IP: ${server_ip}"
        fi
        echo "  Router admin panel: http://192.168.1.1 or http://192.168.0.1"
        echo ""
    fi

    echo "  Certs: certs/  (copy client.crt + client.key + ca.crt to your app)"
    echo ""
}

# ── Main ──────────────────────────────────────────────────────────────────────

print_banner
check_dependencies

# Phase 1: Questions (foreground, fast)
ask_language
select_model
select_setup_mode
ask_remote_access

echo ""
info "Starting background jobs..."
write_config
generate_certificates
setup_mdns

# Phase 2: Start all background jobs
start_qdrant_background  &
download_model_background &
build_server_background  &
finalize_background      &

# Phase 3: Onboarding while background work runs
run_onboarding

# Phase 4: Progress until done
wait_for_ready

# Phase 5: Summary + QR code
print_summary
show_qr
