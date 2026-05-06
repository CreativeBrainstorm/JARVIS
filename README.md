# JARVIS HUD

Iron Man–style HUD that talks to an [OpenClaw](https://github.com/openclaw/openclaw)
gateway over WebSocket. The gateway is the brain; this repo is just the
front-end client (and a couple of diagnostic scripts).

## Architecture

```
Telegram ──┐
WebChat ───┤──▶ OpenClaw Gateway (VPS, Easypanel) ──▶ ATLAS (Claude / Codex)
HUD ───────┘                  ▲
                              │
                       custom skills
```

The HUD is one more channel into the same conversation — same brain, same
sessions, same skills as the official OpenClaw clients.

## Layout

```
frontend/        Static HUD (HTML / CSS / vanilla JS) — served by nginx
  index.html
  css/
  js/
    openclaw.js  WebSocket client for the gateway (connect handshake,
                 streaming events, chat.send)
    app.js       UI wiring (chat, skills panel, status, clock)
    animations.js
tools/           Diagnostic Python scripts (need `pip install websockets`)
  openclaw_probe.py   one-shot connect handshake
  openclaw_chat.py    full send-and-stream flow
```

## Running the HUD locally

It's static, so anything that serves a directory works:

```bash
cd frontend
python -m http.server 8090
```

Open `http://localhost:8090/?token=<gateway-token>` once. The token is saved
to `localStorage` and stripped from the URL, so subsequent visits don't need
it.

## Deploying

The HUD lives on the VPS at `/home/ubuntu/jarvis-hud/frontend/`, served by
an `nginx:alpine` container (`jarvis-hud`) on port `8090`. The directory is
a bind mount, so updating files on the host updates the served HUD with no
container restart — just hard-refresh the browser.

## Probing the gateway from a terminal

```bash
pip install websockets
export OPENCLAW_GATEWAY_TOKEN=<gateway-token>
python tools/openclaw_probe.py        # handshake only
python tools/openclaw_chat.py "hola"  # full chat round-trip
```

## License

MIT
