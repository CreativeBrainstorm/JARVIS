"""Send a message to the OpenClaw assistant via the gateway WebSocket and
print the streaming response. Reuses the connect handshake from the probe.

Usage:
    OPENCLAW_GATEWAY_TOKEN=... python tools/openclaw_chat.py "hola, ¿quien eres?"
"""

import asyncio
import json
import os
import sys
import uuid

import websockets

URL = "wss://iabot-openclaw-gateway.slb810.easypanel.host/"
DEFAULT_SESSION = "agent:main:main"


def connect_params(token: str) -> dict:
    return {
        "minProtocol": 3,
        "maxProtocol": 3,
        "client": {
            "id": "openclaw-probe",
            "version": "0.0.1",
            "platform": "linux",
            "mode": "probe",
            "instanceId": str(uuid.uuid4()),
        },
        "role": "operator",
        "scopes": ["operator.read", "operator.write"],
        "caps": [],
        "auth": {"token": token},
        "userAgent": "jarvis-hud-probe/0.0.1",
        "locale": "es-ES",
    }


async def request(ws, method: str, params: dict, timeout: float = 10.0) -> dict:
    req_id = str(uuid.uuid4())
    await ws.send(json.dumps({"type": "req", "id": req_id, "method": method, "params": params}))
    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout=timeout)
        msg = json.loads(raw)
        if msg.get("type") == "res" and msg.get("id") == req_id:
            return msg
        # ignore events while waiting for the matching res
        kind = f"{msg.get('type')}/{msg.get('event') or msg.get('method') or ''}"
        print(f"  [evt while waiting {method}] {kind}: {raw[:160]}")


async def main() -> None:
    text = sys.argv[1] if len(sys.argv) > 1 else "Hola, ¿estás ahí?"
    session = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_SESSION
    token = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
    if not token:
        print("ERROR: OPENCLAW_GATEWAY_TOKEN env var is required", file=sys.stderr)
        sys.exit(1)

    print(f"[chat] connecting to {URL}")
    async with websockets.connect(URL, max_size=2**20) as ws:
        # Server pushes connect.challenge first
        await asyncio.wait_for(ws.recv(), timeout=10)
        # Send connect
        res = await request(ws, "connect", connect_params(token))
        if not res.get("ok"):
            print(f"[chat] connect FAILED: {res}")
            return
        print(f"[chat] connected (protocol={res['payload'].get('protocol')})")

        # List sessions to confirm the one we want exists
        try:
            res = await request(ws, "sessions.list", {})
            if res.get("ok"):
                sessions = res["payload"].get("sessions", res["payload"])
                print(f"[chat] sessions.list ok, count={len(sessions) if isinstance(sessions, list) else '?'}")
                if isinstance(sessions, list):
                    for s in sessions[:5]:
                        print(f"  - {s.get('key') or s.get('id') or s}")
        except Exception as e:
            print(f"[chat] sessions.list error: {e}")

        # Send a chat message
        print(f"[chat] sending: {text!r} to session {session!r}")
        send_params = {
            "sessionKey": session,
            "message": text,
            "idempotencyKey": str(uuid.uuid4()),
        }
        try:
            res = await request(ws, "chat.send", send_params, timeout=20)
            print(f"[chat] chat.send response: {json.dumps(res)[:400]}")
        except Exception as e:
            print(f"[chat] chat.send error: {e}")
            return

        # Now listen for streaming events for ~30s
        print("[chat] listening for response events (30s)...")
        deadline = asyncio.get_event_loop().time() + 30
        while asyncio.get_event_loop().time() < deadline:
            try:
                raw = await asyncio.wait_for(ws.recv(), timeout=5)
            except asyncio.TimeoutError:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                print(f"  raw: {raw[:200]}")
                continue
            if msg.get("type") == "event":
                ev = msg.get("event", "?")
                payload = msg.get("payload", {})
                # Trim noisy fields for readability
                summary = json.dumps(payload)[:200]
                print(f"  event {ev}: {summary}")


if __name__ == "__main__":
    asyncio.run(main())
