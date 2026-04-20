#!/bin/bash
set -e

CERTS_DIR="certs"
SERVER_IP=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --server-ip) SERVER_IP="$2"; shift 2 ;;
        *) echo "Unknown argument: $1"; exit 1 ;;
    esac
done

if [[ -z "$SERVER_IP" ]]; then
    if [[ "$(uname)" == "Darwin" ]]; then
        SERVER_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")"
    else
        SERVER_IP="$(ip -4 addr show scope global | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1 || echo "")"
    fi
fi

SAN="DNS:localhost,DNS:ombra.local,IP:127.0.0.1"
if [[ -n "$SERVER_IP" && "$SERVER_IP" != "127.0.0.1" ]]; then
    SAN="$SAN,IP:$SERVER_IP"
fi

mkdir -p "$CERTS_DIR"

echo "Generating Ombra development certificates..."
[[ -n "$SERVER_IP" ]] && echo "Server IP in SAN: $SERVER_IP"

# 1. Certificate Authority
openssl genrsa -out "$CERTS_DIR/ca.key" 4096 2>/dev/null
openssl req -new -x509 -days 3650 \
    -key "$CERTS_DIR/ca.key" \
    -out "$CERTS_DIR/ca.crt" \
    -subj "/CN=Ombra Local CA/O=Ombra"

# 2. Server certificate
openssl genrsa -out "$CERTS_DIR/server.key" 2048 2>/dev/null
openssl req -new \
    -key "$CERTS_DIR/server.key" \
    -out "$CERTS_DIR/server.csr" \
    -subj "/CN=ombra-server/O=Ombra"
openssl x509 -req -days 365 \
    -in "$CERTS_DIR/server.csr" \
    -CA "$CERTS_DIR/ca.crt" \
    -CAkey "$CERTS_DIR/ca.key" \
    -CAcreateserial \
    -extfile <(printf "subjectAltName=%s" "$SAN") \
    -out "$CERTS_DIR/server.crt" 2>/dev/null

# 3. Client certificate — represents iPhone or hardware device
openssl genrsa -out "$CERTS_DIR/client.key" 2048 2>/dev/null
openssl req -new \
    -key "$CERTS_DIR/client.key" \
    -out "$CERTS_DIR/client.csr" \
    -subj "/CN=ombra-client/O=Ombra"
openssl x509 -req -days 365 \
    -in "$CERTS_DIR/client.csr" \
    -CA "$CERTS_DIR/ca.crt" \
    -CAkey "$CERTS_DIR/ca.key" \
    -CAcreateserial \
    -out "$CERTS_DIR/client.crt" 2>/dev/null

cp "$CERTS_DIR/ca.crt" "$CERTS_DIR/client-ca.crt"

chmod 600 "$CERTS_DIR/"*.key
rm -f "$CERTS_DIR/"*.csr "$CERTS_DIR/"*.srl

SERVER_HOST="${SERVER_IP:-localhost}"

echo ""
echo "Certificates written to $CERTS_DIR/"
echo "SAN covers: $SAN"
echo ""
echo "Test the server (once running):"
echo ""
echo "  Health check (localhost):"
echo "  curl --cacert $CERTS_DIR/ca.crt \\"
echo "       --cert $CERTS_DIR/client.crt \\"
echo "       --key  $CERTS_DIR/client.key \\"
echo "       https://localhost:8080/health"
echo ""
if [[ -n "$SERVER_IP" && "$SERVER_IP" != "127.0.0.1" ]]; then
echo "  Health check (LAN — for mobile app):"
echo "  curl --cacert $CERTS_DIR/ca.crt \\"
echo "       --cert $CERTS_DIR/client.crt \\"
echo "       --key  $CERTS_DIR/client.key \\"
echo "       https://$SERVER_IP:8080/health"
echo ""
fi
echo "  WebSocket (requires websocat):"
echo "  websocat --ssl-domain $SERVER_HOST \\"
echo "           --client-cert-key $CERTS_DIR/client.crt:$CERTS_DIR/client.key \\"
echo "           wss://$SERVER_HOST:8080/ws/transcript"
echo ""
echo "A request WITHOUT a client cert will be rejected by mTLS — try it:"
echo "  curl --cacert $CERTS_DIR/ca.crt https://localhost:8080/health"
