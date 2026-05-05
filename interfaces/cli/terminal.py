"""
JARVIS AI Agent — CLI Terminal Interface
==========================================
Rich interactive terminal for chatting with JARVIS.
"""

import asyncio

from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.text import Text

from config.settings import settings
from core.orchestrator import JarvisOrchestrator


console = Console()


JARVIS_BANNER = """
     ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗
     ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝
     ██║███████║██████╔╝██║   ██║██║███████╗
██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║
╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║
 ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝
   Just A Rather Very Intelligent System
"""


async def run_cli() -> None:
    """Run the interactive CLI terminal."""
    console.clear()
    console.print(
        Panel(
            Text(JARVIS_BANNER, style="bold cyan", justify="center"),
            border_style="cyan",
            padding=(1, 2),
        )
    )
    console.print(
        f"[dim]v{settings.agent_version} | Model: {settings.llm_model} | "
        f"Type /help for commands[/dim]\n"
    )

    # Initialize JARVIS
    orchestrator = JarvisOrchestrator()
    await orchestrator.initialize()

    console.print("[bold green]Good evening, Sir. All systems are operational.[/bold green]\n")

    while True:
        try:
            # Prompt
            user_input = console.input("[bold cyan]You ❯ [/bold cyan]")

            if not user_input.strip():
                continue

            # Process
            console.print()
            with console.status("[cyan]Processing...[/cyan]", spinner="dots"):
                response = await orchestrator.process_input(user_input)

            # Check for exit
            if response == "__EXIT__":
                console.print(
                    "\n[bold cyan]Goodbye, Sir. JARVIS signing off.[/bold cyan]\n"
                )
                break

            # Display response
            console.print(
                Panel(
                    Markdown(response),
                    title="[bold cyan]JARVIS[/bold cyan]",
                    border_style="blue",
                    padding=(1, 2),
                )
            )
            console.print()

        except KeyboardInterrupt:
            console.print("\n[yellow]Interrupted. Type /exit to quit.[/yellow]\n")
        except EOFError:
            break
        except Exception as e:
            console.print(f"\n[red]Error: {e}[/red]\n")

    # Cleanup
    await orchestrator.shutdown()
