"""
JARVIS AI Agent — State Management
=====================================
Defines the state schema used by the orchestrator graph.
"""

from dataclasses import dataclass, field
from typing import Any


@dataclass
class JarvisState:
    """
    State object for the JARVIS orchestrator.

    Carries all context through the processing pipeline:
    perceive → plan → act → respond
    """

    # User input
    user_input: str = ""

    # Conversation messages for LLM
    messages: list[dict[str, str]] = field(default_factory=list)

    # Intent classification
    intent: str = "conversation"  # conversation, tool_use, system_command
    intent_confidence: float = 0.0

    # Tool execution
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    tool_results: list[dict[str, Any]] = field(default_factory=list)

    # Response
    response: str = ""
    response_metadata: dict[str, Any] = field(default_factory=dict)

    # Knowledge context from RAG
    retrieved_context: str = ""

    # Processing flags
    needs_tool_execution: bool = False
    is_complete: bool = False
    error: str | None = None
