"""
JARVIS AI Agent — Intent Router
==================================
Classifies user input and routes to the appropriate
handler (conversation, tool use, or system command).
"""

import re

from loguru import logger


# Keywords that indicate tool-related requests
TOOL_KEYWORDS = {
    "system_monitor": [
        "cpu", "ram", "memory", "disk", "battery", "system info",
        "system status", "performance", "recursos", "sistema",
        "rendimiento", "memoria", "disco", "batería",
    ],
    "get_datetime": [
        "time", "date", "day", "hora", "fecha", "día", "qué hora",
        "what time", "what day", "today", "hoy",
    ],
}

# System commands that bypass the LLM
SYSTEM_COMMANDS = {
    "/exit": "exit",
    "/quit": "exit",
    "/clear": "clear",
    "/tools": "list_tools",
    "/memory": "memory_status",
    "/help": "help",
    "/status": "system_status",
}


def classify_intent(user_input: str) -> tuple[str, str, float]:
    """
    Classify the user's intent from their input.

    Returns:
        Tuple of (intent_type, target, confidence)
        - intent_type: 'system_command', 'tool_hint', 'conversation'
        - target: specific tool name or command
        - confidence: 0.0 to 1.0
    """
    text = user_input.strip().lower()

    # Check for system commands first
    if text in SYSTEM_COMMANDS:
        cmd = SYSTEM_COMMANDS[text]
        logger.debug(f"Router: System command detected — {cmd}")
        return "system_command", cmd, 1.0

    # Check for tool-related keywords (hint to the LLM)
    for tool_name, keywords in TOOL_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                logger.debug(f"Router: Tool hint detected — {tool_name} (keyword: '{kw}')")
                return "tool_hint", tool_name, 0.7

    # Default: general conversation (let the LLM decide)
    return "conversation", "", 0.5


def is_system_command(text: str) -> bool:
    """Check if input is a system command."""
    return text.strip().lower() in SYSTEM_COMMANDS


def get_system_command(text: str) -> str | None:
    """Get the system command name, or None."""
    return SYSTEM_COMMANDS.get(text.strip().lower())
