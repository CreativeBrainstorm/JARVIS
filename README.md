# JARVIS

Personal AI agent with a neuron-based architecture. Each neuron is a specialized
workspace (system prompt + knowledge + tools) that the orchestrator can invoke.

## Quick start

```bash
pip install -e .

cp .env.example .env
# edit .env and set OPENAI_API_KEY

python -m backend.main
```

Open http://localhost:8000 in your browser.

## Architecture

```
HUD (browser)
    │  WebSocket /api/ws/chat
    ▼
FastAPI server  ──►  Orchestrator  ──►  Neurons (hello, ...)
                                         │
                                         └──►  OpenAI API
```

Each neuron lives under `backend/neurons/<name>/config.yaml`. Adding a neuron
is dropping a YAML; no code changes required.

## License

MIT
