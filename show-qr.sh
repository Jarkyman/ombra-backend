#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
CONFIG_FILE="$SCRIPT_DIR/ombra.toml"

if ! command -v qrencode >/dev/null 2>&1; then
    echo "qrencode is not installed. Run: sudo apt install qrencode"
    exit 1
fi

if [[ ! -f "$CERTS_DIR/ca.crt" || ! -f "$CERTS_DIR/client.crt" || ! -f "$CERTS_DIR/client.key" ]]; then
    echo "Certificates not found. Run setup.sh first."
    exit 1
fi

port="$(grep 'server_port' "$CONFIG_FILE" 2>/dev/null | awk -F'= ' '{print $2}' | tr -d ' ')"
port="${port:-8080}"

ca_cert="$(openssl base64 -A -in "$CERTS_DIR/ca.crt")"
client_cert="$(openssl base64 -A -in "$CERTS_DIR/client.crt")"
client_key="$(openssl base64 -A -in "$CERTS_DIR/client.key")"

payload="$(printf '{"host":"ombra.local","port":%s,"ca_cert":"%s","client_cert":"%s","client_key":"%s"}' \
    "$port" "$ca_cert" "$client_cert" "$client_key")"

echo ""
echo "Scan with the Ombra app to connect:"
echo ""
qrencode -t UTF8 "$payload"
echo ""
