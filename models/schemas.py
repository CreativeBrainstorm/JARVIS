"""
JARVIS AI Agent — Data Schemas
================================
Pydantic models for structured data across the application.
"""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from utils.helpers import utc_now


class Role(str, Enum):
    """Message role in conversation."""
    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Message(BaseModel):
    """A single message in a conversation."""
    role: Role
    content: str
    name: str | None = None
    tool_call_id: str | None = None
    timestamp: datetime = Field(default_factory=utc_now)

    def to_llm_dict(self) -> dict[str, str]:
        """Convert to the format expected by LLM APIs."""
        d: dict[str, str] = {"role": self.role.value, "content": self.content}
        if self.name:
            d["name"] = self.name
        if self.tool_call_id:
            d["tool_call_id"] = self.tool_call_id
        return d


class ToolCall(BaseModel):
    """A tool call requested by the LLM."""
    id: str
    name: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class ToolResult(BaseModel):
    """Result from executing a tool."""
    tool_call_id: str
    name: str
    result: Any
    success: bool = True
    error: str | None = None
    execution_time: float = 0.0


class JarvisResponse(BaseModel):
    """Complete response from JARVIS."""
    message: str
    tool_calls: list[ToolCall] = Field(default_factory=list)
    tool_results: list[ToolResult] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=utc_now)


class ConversationSummary(BaseModel):
    """Summary of a conversation for episodic memory."""
    conversation_id: str
    title: str = ""
    summary: str = ""
    message_count: int = 0
    started_at: datetime = Field(default_factory=utc_now)
    ended_at: datetime | None = None
    tags: list[str] = Field(default_factory=list)
