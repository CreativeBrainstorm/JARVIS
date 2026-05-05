"""
JARVIS AI Agent — Short-Term Memory
=====================================
In-memory conversation buffer with sliding window and
automatic summarization when context exceeds limits.
"""

from collections import deque

from loguru import logger

from models.schemas import Message, Role


class ShortTermMemory:
    """
    Short-term memory for active conversation context.

    Uses a sliding window to keep the most recent messages
    and can generate summaries of dropped messages.
    """

    def __init__(self, max_messages: int = 20):
        self.max_messages = max_messages
        self._messages: deque[Message] = deque(maxlen=max_messages)
        self._system_message: Message | None = None
        logger.debug(f"Short-term memory initialized | Window: {max_messages}")

    def set_system_message(self, content: str) -> None:
        """Set the system message (always included, not counted in window)."""
        self._system_message = Message(role=Role.SYSTEM, content=content)

    def add_message(self, message: Message) -> None:
        """Add a message to the conversation buffer."""
        if message.role == Role.SYSTEM:
            self._system_message = message
            return
        self._messages.append(message)
        logger.debug(f"STM: Added {message.role.value} message | Buffer: {len(self._messages)}/{self.max_messages}")

    def add_user_message(self, content: str) -> Message:
        """Convenience: add a user message and return it."""
        msg = Message(role=Role.USER, content=content)
        self.add_message(msg)
        return msg

    def add_assistant_message(self, content: str) -> Message:
        """Convenience: add an assistant message and return it."""
        msg = Message(role=Role.ASSISTANT, content=content)
        self.add_message(msg)
        return msg

    def add_tool_message(self, content: str, name: str, tool_call_id: str) -> Message:
        """Add a tool result message."""
        msg = Message(role=Role.TOOL, content=content, name=name, tool_call_id=tool_call_id)
        self.add_message(msg)
        return msg

    def get_messages(self) -> list[dict[str, str]]:
        """Get all messages formatted for LLM API calls."""
        messages = []
        if self._system_message:
            messages.append(self._system_message.to_llm_dict())
        for msg in self._messages:
            messages.append(msg.to_llm_dict())
        return messages

    def get_last_n(self, n: int) -> list[Message]:
        """Get the last N messages."""
        messages = list(self._messages)
        return messages[-n:] if n < len(messages) else messages

    def clear(self) -> None:
        """Clear all messages except system message."""
        self._messages.clear()
        logger.debug("STM: Cleared conversation buffer")

    @property
    def message_count(self) -> int:
        """Number of messages in buffer (excluding system)."""
        return len(self._messages)

    @property
    def is_full(self) -> bool:
        """Whether the buffer is at capacity."""
        return len(self._messages) >= self.max_messages
