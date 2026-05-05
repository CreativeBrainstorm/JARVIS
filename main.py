"""
JARVIS AI Agent — Main Entry Point
=====================================
Starts JARVIS in the selected mode: CLI, Server, or Full.

Usage:
    python main.py                  # Default: starts server mode
    python main.py --mode cli       # Interactive terminal
    python main.py --mode server    # API server + Web HUD
    python main.py --mode full      # Server + CLI (not yet implemented)
"""

import argparse
import asyncio
import sys

# Ensure project root is in path
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))


def main():
    """Parse arguments and start JARVIS."""
    parser = argparse.ArgumentParser(
        description="JARVIS — Just A Rather Very Intelligent System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["cli", "server", "full"],
        default="server",
        help="Run mode: 'cli' for terminal, 'server' for API + Web HUD (default: server)",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Server host (overrides config)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=None,
        help="Server port (overrides config)",
    )

    args = parser.parse_args()

    if args.mode == "cli":
        run_cli_mode()
    elif args.mode == "server":
        run_server_mode(host=args.host, port=args.port)
    elif args.mode == "full":
        print("Full mode (server + CLI) coming soon. Starting server mode...")
        run_server_mode(host=args.host, port=args.port)


def run_cli_mode():
    """Start JARVIS in interactive CLI mode."""
    from interfaces.cli.terminal import run_cli
    asyncio.run(run_cli())


def run_server_mode(host: str | None = None, port: int | None = None):
    """Start JARVIS as a FastAPI server."""
    import uvicorn
    from config.settings import settings

    server_host = host or settings.host
    server_port = port or settings.port

    print(f"""
    +----------------------------------------------+
    |                                              |
    |     J.A.R.V.I.S. -- AI Assistant Server      |
    |                                              |
    |     Web:       http://{server_host}:{server_port:<5}            |
    |     WebSocket: ws://{server_host}:{server_port:<5}/api/ws/chat |
    |                                              |
    +----------------------------------------------+
    """)

    uvicorn.run(
        "interfaces.api.server:app",
        host=server_host,
        port=server_port,
        reload=settings.debug,
        log_level="info",
    )


if __name__ == "__main__":
    main()
