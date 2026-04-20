#!/usr/bin/env python3
"""
Ombra server integration test.

Tests the full pipeline: WebSocket ingestion → cluster processing → REST → query.

Usage:
    cd ~/ombra-backend
    python3 scripts/test_server.py

For the query test to return results, set cluster_timeout_minutes = 0 in ombra.toml
before starting the server — this makes clusters close immediately after each transcript.
"""

import asyncio
import json
import ssl
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "https://localhost:8080"
CA_CERT   = "certs/ca.crt"
CLIENT_CRT = "certs/client.crt"
CLIENT_KEY = "certs/client.key"

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

passed = 0
failed = 0


def ok(label: str, detail: str = ""):
    global passed
    passed += 1
    suffix = f"  {detail}" if detail else ""
    print(f"  {GREEN}✓{RESET} {label}{suffix}")


def fail(label: str, detail: str = ""):
    global failed
    failed += 1
    suffix = f"  {detail}" if detail else ""
    print(f"  {RED}✗{RESET} {label}{suffix}")


def section(title: str):
    print(f"\n{BOLD}{title}{RESET}")


def build_ssl_context() -> ssl.SSLContext:
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_verify_locations(CA_CERT)
    ctx.load_cert_chain(certfile=CLIENT_CRT, keyfile=CLIENT_KEY)
    return ctx


def http_get(path: str) -> tuple[int, bytes]:
    ctx = build_ssl_context()
    req = urllib.request.Request(f"{BASE_URL}{path}")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def http_post(path: str, body: dict) -> tuple[int, bytes]:
    ctx = build_ssl_context()
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=60) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


async def send_transcripts_via_websocket(chunks: list[dict]) -> bool:
    try:
        import websockets
    except ImportError:
        print(f"  {YELLOW}!{RESET} websockets not installed — skipping WebSocket tests")
        print(f"      Install with: pip3 install websockets")
        return False

    ctx = build_ssl_context()
    ctx.check_hostname = False

    uri = "wss://localhost:8080/ws/transcript"
    try:
        async with websockets.connect(uri, ssl=ctx) as ws:
            for chunk in chunks:
                await ws.send(json.dumps(chunk))
                await asyncio.sleep(0.1)
        return True
    except Exception as e:
        fail("WebSocket connection", str(e))
        return False


def test_health():
    section("1. Health check")
    status, body = http_get("/health")
    if status == 200:
        ok("GET /health → 200")
    else:
        fail("GET /health", f"got {status}")


SESSION_ID = f"test-session-{int(time.time())}"

TRANSCRIPTS = [
    {
        "session_id": SESSION_ID,
        "text": "Møde med Lars i dag. Han sagde at projektet er forsinket med to uger.",
        "recorded_at": int(time.time() * 1000),
    },
    {
        "session_id": SESSION_ID,
        "text": "Lars nævnte at de mangler en backend-udvikler og spurgte om jeg kendte nogen.",
        "recorded_at": int(time.time() * 1000) + 5000,
    },
    {
        "session_id": SESSION_ID,
        "text": "Vi aftalte at følge op på fredag med en ny timeline.",
        "recorded_at": int(time.time() * 1000) + 10000,
    },
    {
        "session_id": SESSION_ID,
        "text": "[BLANK_AUDIO]",
        "recorded_at": int(time.time() * 1000) + 15000,
    },
]


def test_websocket():
    section("2. WebSocket — transcript ingestion")

    result = asyncio.run(send_transcripts_via_websocket(TRANSCRIPTS))
    if result:
        ok("Sent 3 real transcripts + 1 [BLANK_AUDIO] via WebSocket")


def test_sessions():
    section("3. REST — sessions")
    time.sleep(1)

    status, body = http_get("/sessions")
    if status != 200:
        fail("GET /sessions", f"got {status}")
        return

    sessions = json.loads(body)
    match = next((s for s in sessions if s["session_id"] == SESSION_ID), None)

    if match:
        count = match["transcript_count"]
        ok(f"Session visible in /sessions  (transcript_count={count})")
        if count == 3:
            ok("[BLANK_AUDIO] correctly filtered — only 3 transcripts stored")
        elif count == 4:
            fail("[BLANK_AUDIO] NOT filtered — 4 transcripts stored instead of 3")
        else:
            fail(f"Unexpected transcript count: {count} (expected 3)")
    else:
        fail("Session not found in /sessions — ingestion may have failed")


def test_clusters():
    section("4. REST — clusters (requires cluster_timeout_minutes = 0)")

    print("  Waiting for AI cluster processing (up to 90s)...", end="", flush=True)
    deadline = time.time() + 90
    clusters = []
    while time.time() < deadline:
        status, body = http_get(f"/sessions/{SESSION_ID}/clusters")
        if status != 200:
            fail(f"GET /sessions/{SESSION_ID}/clusters", f"got {status}")
            return False
        clusters = json.loads(body)
        if clusters:
            break
        print(".", end="", flush=True)
        time.sleep(5)
    print()

    if clusters:
        c = clusters[0]
        ok(f"{len(clusters)} cluster(s) found  (event_type={c['event_type']!r}, relevance={c['relevance_score']:.2f})")
        ok(f"Summary: {c['event_summary'][:80]}...")
        return True
    else:
        print(f"  {YELLOW}!{RESET} No clusters after 90s — cluster_timeout_minutes may not be 0,")
        print(f"      or AI processing failed. Check server logs.")
        return False


def test_query(has_clusters: bool):
    section("5. Query endpoint")

    if not has_clusters:
        print(f"  {YELLOW}!{RESET} Skipping query — no clusters to search over.")
        return

    print("  Sending query (model inference may take 10–60s)...")
    status, body = http_post("/query", {"text": "Hvad talte jeg med Lars om?"})

    if status != 200:
        fail("POST /query", f"got {status}")
        return

    resp = json.loads(body)
    answer = resp.get("answer", "")
    sources = resp.get("sources", [])

    if answer and answer != "Nothing captured about this.":
        ok(f"Got answer with {len(sources)} source(s)")
        print(f"\n  Answer:\n  {answer}\n")
    elif answer == "Nothing captured about this.":
        fail("Query returned 'Nothing captured' — Qdrant may not have the cluster embedded yet")
    else:
        fail("Empty answer")


def test_empty_transcript_rejected():
    section("6. Empty transcript filter (isolated)")

    blank_only = [
        {"session_id": f"blank-test-{int(time.time())}", "text": "[BLANK_AUDIO]", "recorded_at": int(time.time() * 1000)},
    ]
    result = asyncio.run(send_transcripts_via_websocket(blank_only))
    if result:
        time.sleep(0.5)
        status, body = http_get("/sessions")
        sessions = json.loads(body) if status == 200 else []
        blank_session = next((s for s in sessions if s["session_id"] == blank_only[0]["session_id"]), None)
        if blank_session is None:
            ok("[BLANK_AUDIO]-only session not stored (correct)")
        else:
            fail("[BLANK_AUDIO]-only session appeared in /sessions (should have been discarded)")


def test_no_cert_rejected():
    section("7. mTLS — request without client cert must be rejected")
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.load_verify_locations(CA_CERT)

    req = urllib.request.Request(f"{BASE_URL}/health")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=5):
            fail("Request without client cert was accepted (mTLS not enforced!)")
    except Exception:
        ok("Request without client cert was rejected by mTLS")


if __name__ == "__main__":
    print(f"\n{BOLD}Ombra server integration tests{RESET}")
    print(f"Session ID: {SESSION_ID}")

    test_health()
    test_websocket()
    test_sessions()
    has_clusters = test_clusters()
    test_query(has_clusters)
    test_empty_transcript_rejected()
    test_no_cert_rejected()

    print(f"\n{'─' * 48}")
    total = passed + failed
    if failed == 0:
        print(f"{GREEN}{BOLD}All {total} tests passed{RESET}")
    else:
        print(f"{RED}{BOLD}{failed} failed{RESET}, {passed} passed  ({total} total)")
    print()
    sys.exit(0 if failed == 0 else 1)
