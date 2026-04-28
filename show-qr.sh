#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
CONFIG_FILE="$SCRIPT_DIR/ombra.toml"
TOKEN_FILE="$SCRIPT_DIR/provision_token"

if ! command -v qrencode >/dev/null 2>&1; then
    echo "qrencode is not installed. Run: sudo apt install qrencode"
    exit 1
fi

if [[ ! -f "$CERTS_DIR/ca.crt" ]]; then
    echo "Certificates not found. Run setup.sh first."
    exit 1
fi

server_port="$(grep 'server_port' "$CONFIG_FILE" 2>/dev/null | head -1 | awk -F'= ' '{print $2}' | tr -d ' ')"
server_port="${server_port:-8080}"

provision_port="$(grep 'provision_port' "$CONFIG_FILE" 2>/dev/null | head -1 | awk -F'= ' '{print $2}' | tr -d ' ')"
provision_port="${provision_port:-8081}"

token="$(openssl rand -hex 16)"
printf '%s' "$token" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

ca_fp="$(openssl x509 -noout -fingerprint -sha256 -in "$CERTS_DIR/ca.crt" \
    | awk -F'=' '{print $2}' \
    | tr -d ':')"

payload="$(printf '{"host":"ombra.local","port":%s,"provision_port":%s,"token":"%s","ca_fp":"%s"}' \
    "$server_port" "$provision_port" "$token" "$ca_fp")"

echo ""
echo "Scan with the Ombra app to connect:"
echo ""
qrencode -t UTF8 "$payload"
echo ""
echo "This QR code can be reused to set up multiple devices."
echo "Run this script again to rotate to a new token."
echo ""
