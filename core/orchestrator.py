"""
JARVIS AI Agent — Orchestrator
=================================
Central orchestrator that coordinates all JARVIS subsystems.
This is the "brain" that ties everything together.
"""

from loguru import logger

from config.settings import settings
from core.conversation import ConversationEngine
from core.router import classify_intent, get_system_command
from memory.manager import MemoryManager
from models.provider import LLMProvider
from tools.registry import ToolRegistry
from utils.logger import setup_logger


class JarvisOrchestrator:
    """
    The brain of JARVIS.

    Coordinates:
    - LLM Provider (intelligence)
    - Memory Manager (memory)
    - Tool Registry (capabilities)
    - Conversation Engine (interaction)
    - Router (intent classification)
    """

    def __init__(self):
        # Initialize logging
        setup_logger(log_level=settings.log_level, log_dir=settings.log_dir)

        # Initialize subsystems
        self.llm = LLMProvider()
        self.memory = MemoryManager()
        self.tools = ToolRegistry()
        self.conversation = ConversationEngine(
            llm=self.llm,
            memory=self.memory,
            tool_registry=self.tools,
        )

        self._initialized = False
        logger.info(f"🤖 {settings.agent_name} Orchestrator created")

    async def initialize(self) -> None:
        """Initialize all async subsystems."""
        if self._initialized:
            return

        # Initialize memory (creates DB tables, etc.)
        await self.memory.initialize()

        # Load default tools
        self.tools.load_default_tools()

        self._initialized = True
        logger.info(f"🤖 {settings.agent_name} v{settings.agent_version} — All systems online")

    async def process_input(self, user_input: str) -> str:
        """
        Process user input through the full pipeline.

        1. Classify intent
        2. Handle system commands or route to conversation
        3. Return response

        Args:
            user_input: Raw user input text

        Returns:
            JARVIS's response text
        """
        if not self._initialized:
            await self.initialize()

        text = user_input.strip()
        if not text:
            return ""

        # Classify intent
        intent_type, target, confidence = classify_intent(text)
        logger.debug(f"Intent: {intent_type} | Target: {target} | Confidence: {confidence}")

        # Handle system commands
        if intent_type == "system_command":
            return await self._handle_system_command(target)

        # Route to conversation engine (handles both chat and tool use)
        response = await self.conversation.process(text)
        return response

    async def _handle_system_command(self, command: str) -> str:
        """Handle internal system commands."""
        if command == "exit":
            await self.shutdown()
            return "__EXIT__"

        elif command == "clear":
            self.memory.clear_conversation()
            return "Conversation cleared, Sir. Starting fresh."

        elif command == "list_tools":
            tools = self.tools.list_tools()
            if not tools:
                return "No tools currently registered."
            lines = ["**Available Tools:**\n"]
            for t in tools:
                lines.append(f"  🔧 **{t['name']}** [{t['category']}] — {t['description']}")
            return "\n".join(lines)

        elif command == "memory_status":
            stm_count = self.memory.short_term.message_count
            ltm_count = self.memory.long_term.count
            return (
                f"**Memory Status:**\n"
                f"  📝 Short-term: {stm_count} messages in buffer\n"
                f"  🧠 Long-term: {ltm_count} documents stored\n"
                f"  📚 Session: {self.memory.conversation_id or 'N/A'}"
            )

        elif command == "help":
            return (
                "**JARVIS Commands:**\n"
                "  `/help`   — Show this help\n"
                "  `/tools`  — List available tools\n"
                "  `/memory` — Memory status\n"
                "  `/clear`  — Clear conversation\n"
                "  `/status` — System status\n"
                "  `/exit`   — Shutdown JARVIS"
            )

        elif command == "system_status":
            from tools.system_monitor.monitor import SystemMonitorTool
            monitor = SystemMonitorTool()
            result = await monitor.execute(component="all")
            data = result.get("result", {})

            lines = ["**System Status:**\n"]
            if "cpu" in data:
                lines.append(f"  ⚡ CPU: {data['cpu']['usage_percent']}% | {data['cpu']['cores_logical']} cores")
            if "memory" in data:
                lines.append(f"  💾 RAM: {data['memory']['usage_percent']}% ({data['memory']['used']} / {data['memory']['total']})")
            if "disk" in data:
                lines.append(f"  💿 Disk: {data['disk']['usage_percent']}% ({data['disk']['free']} free)")
            if "battery" in data:
                batt = data["battery"]
                if "percent" in batt:
                    lines.append(f"  🔋 Battery: {batt['percent']}% {'⚡' if batt.get('plugged_in') else '🔌'}")
            return "\n".join(lines)

        return f"Unknown command: {command}"

    async def shutdown(self) -> None:
        """Graceful shutdown."""
        logger.info("Initiating shutdown sequence...")
        await self.memory.end_session("Session ended by user")
        logger.info("🤖 JARVIS shutdown complete. Goodbye, Sir.")
