"""One-shot probe: connect to OpenClaw Gateway WebSocket, do the handshake,
print whatever the server sends. Reads token from env OPENCLAW_GATEWAY_TOKEN.

Usage:
    OPENCLAW_GATEWAY_TOKEN=... python tools/openclaw_probe.py [URL]

Default URL points to the user's VPS gateway.
"""

import asyncio
import json
import os
import sys
import uuid

import websockets

DEFAULT_URL = "wss://iabot-openclaw-gateway.slb810.easypanel.host/"


async def probe(url: str, token: str) -> None:
    print(f"[probe] connecting to {url}")
    async with websockets.connect(url, max_size=2**20) as ws:
        print("[probe] socket open, waiting for connect.challenge...")
        # Wait for server challenge first
        first = await asyncio.wait_for(ws.recv(), timeout=10)
        print(f"[probe] got: {first[:300]}")

        try:
            challenge = json.loads(first)
        except json.JSONDecodeError:
            print("[probe] first frame not JSON, aborting")
            return

        # Send a connect request with the token (shape mirrors official Control UI)
        req = {
            "type": "req",
            "id": str(uuid.uuid4()),
            "method": "connect",
            "params": {
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
            },
        }
        await ws.send(json.dumps(req))
        print("[probe] sent connect req")

        for _ in range(5):
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
            except asyncio.TimeoutError:
                print("[probe] timeout waiting for more frames")
                break
            print(f"[probe] recv: {msg[:500]}")


async def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_URL
    token = os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
    if not token:
        print("ERROR: OPENCLAW_GATEWAY_TOKEN env var is required", file=sys.stderr)
        sys.exit(1)
    try:
        await probe(url, token)
    except Exception as e:
        print(f"[probe] FAILED: {type(e).__name__}: {e}")


if __name__ == "__main__":
    asyncio.run(main())
