#!/usr/bin/env bash
# Ombra install bootstrap
# curl -sSf https://get.ombra.io | bash
set -euo pipefail

REPO_URL="https://github.com/yourusername/ombra-backend"
INSTALL_DIR="$HOME/ombra"
CARGO_ENV="$HOME/.cargo/env"
SUDO=""
[[ "$(id -u)" != "0" ]] && SUDO="sudo"

BOLD='\033[1m'; DIM='\033[2m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}▸${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1" >&2; exit 1; }

clear
echo ""
echo -e "${BOLD}  Ombra${NC}  ${DIM}— Self-Hosted Personal Memory${NC}"
echo -e "  ${DIM}Your data never leaves your device.${NC}"
echo ""

# ── OS check ─────────────────────────────────────────────────────────────────

if [[ "$(uname)" != "Linux" ]]; then
    error "Ombra requires Ubuntu Linux. For macOS, run setup.sh manually."
fi

if [[ -f /etc/os-release ]]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    if [[ "${ID:-}" != "ubuntu" ]] && [[ "${ID_LIKE:-}" != *"ubuntu"* ]]; then
        error "Ombra requires Ubuntu (detected: ${PRETTY_NAME:-unknown OS}). Other distros coming soon."
    fi
fi

# ── Build tools ───────────────────────────────────────────────────────────────

info "Installing build dependencies..."
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq \
    git curl gcc g++ make cmake \
    pkg-config libssl-dev \
    clang libclang-dev \
    qrencode

# ── Docker ────────────────────────────────────────────────────────────────────

if ! command -v docker >/dev/null 2>&1; then
    info "Installing Docker..."
    $SUDO apt-get install -y -qq ca-certificates gnupg
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
    $SUDO systemctl start docker
    info "Docker installed. You may need to log out and back in for group membership to take effect."
    info "For this session, Docker will be run with sudo."
fi

# ── Rust ──────────────────────────────────────────────────────────────────────

if ! command -v cargo >/dev/null 2>&1; then
    info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --default-toolchain stable --quiet
fi

[[ -f "$CARGO_ENV" ]] && source "$CARGO_ENV"

if ! command -v cargo >/dev/null 2>&1; then
    error "Rust installation failed. Try running: source \$HOME/.cargo/env"
fi

# ── Clone / update repo ───────────────────────────────────────────────────────

if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Updating Ombra..."
    git -C "$INSTALL_DIR" pull --quiet
else
    info "Downloading Ombra..."
    git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

# ── Build setup wizard ────────────────────────────────────────────────────────

info "Building setup wizard (this takes a minute)..."
cargo build --release -p ombra-cli \
    --manifest-path "$INSTALL_DIR/Cargo.toml" \
    --quiet

info "Launching Ombra setup..."
echo ""

cd "$INSTALL_DIR"
exec ./target/release/ombra install
