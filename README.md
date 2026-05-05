# 🤖 J.A.R.V.I.S. — Just A Rather Very Intelligent System

Personal AI Agent inspired by Iron Man's AI assistant. Modular, scalable, and extensible.

## Quick Start

### 1. Install

```bash
# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -e .
```

### 2. Configure

Copy the environment template and add your API keys:

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Run

```bash
# Web HUD mode (default)
python main.py

# CLI mode
python main.py --mode cli

# Custom port
python main.py --port 3000
```

Then open **http://localhost:8000** in your browser.

## Architecture

```
Interface Layer (CLI / Web HUD / Voice / API)
        ↓
Orchestration Layer (Router → Planner → Conversation Engine)
        ↓
Tool Layer (Plugin Registry → Tools)
        ↓
Memory Layer (Short-term / Long-term / Episodic)
        ↓
Model Layer (LiteLLM → OpenAI / Anthropic / Ollama)
```

## Available Commands

| Command    | Description          |
|:-----------|:---------------------|
| `/help`    | Show help            |
| `/tools`   | List available tools |
| `/memory`  | Memory status        |
| `/status`  | System status        |
| `/clear`   | Clear conversation   |
| `/exit`    | Shutdown JARVIS      |

## Tech Stack

- **Backend**: Python 3.12+ / FastAPI / WebSockets
- **LLM**: LiteLLM (multi-provider)
- **Memory**: ChromaDB + SQLite
- **Frontend**: Vanilla HTML/CSS/JS (Iron Man HUD)
- **CLI**: Rich terminal

## License

MIT
