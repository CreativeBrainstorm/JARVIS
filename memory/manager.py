"""
JARVIS AI Agent — Memory Manager
===================================
Unified interface to all memory subsystems.
"""

from loguru import logger

from config.settings import settings
from memory.episodic import EpisodicMemory
from memory.long_term import LongTermMemory
from memory.short_term import ShortTermMemory


class MemoryManager:
    """
    Central memory manager providing unified access to:
    - Short-term memory (conversation buffer)
    - Long-term memory (vector store / knowledge)
    - Episodic memory (conversation history)
    """

    def __init__(self):
        self.short_term = ShortTermMemory(max_messages=settings.memory_window)
        self.long_term = LongTermMemory(persist_directory=str(settings.chroma_dir))
        self.episodic = EpisodicMemory(db_path=str(settings.sqlite_file))

        self._current_conversation_id: str | None = None
        logger.info("Memory Manager initialized")

    async def initialize(self) -> None:
        """Initialize all async-dependent memory systems."""
        await self.episodic.initialize()

        # Set system personality prompt
        self.short_term.set_system_message(settings.personality_prompt)

        # Start a new conversation episode
        self._current_conversation_id = await self.episodic.create_conversation(
            title="New Session"
        )
        logger.info(f"Session started | Conversation: {self._current_conversation_id[:8]}...")

    @property
    def conversation_id(self) -> str | None:
        return self._current_conversation_id

    async def add_user_message(self, content: str) -> None:
        """Record a user message across all memory systems."""
        self.short_term.add_user_message(content)

        if self._current_conversation_id:
            await self.episodic.store_message(
                self._current_conversation_id, "user", content
            )

    async def add_assistant_message(self, content: str) -> None:
        """Record an assistant message across all memory systems."""
        self.short_term.add_assistant_message(content)

        if self._current_conversation_id:
            await self.episodic.store_message(
                self._current_conversation_id, "assistant", content
            )

    def get_context_messages(self) -> list[dict[str, str]]:
        """Get current conversation context for LLM calls."""
        return self.short_term.get_messages()

    async def search_knowledge(self, query: str, n: int = 3) -> str:
        """
        Search long-term memory and return formatted context.

        Returns a string to inject into the conversation.
        """
        results = self.long_term.search(query, n_results=n)
        if not results:
            return ""

        context_parts = ["[Retrieved Knowledge]"]
        for r in results:
            context_parts.append(f"- {r['text']}")

        return "\n".join(context_parts)

    async def store_knowledge(self, text: str, source: str = "conversation") -> None:
        """Store a piece of knowledge in long-term memory."""
        self.long_term.store(text, metadata={"source": source})

    def clear_conversation(self) -> None:
        """Clear the current conversation context."""
        self.short_term.clear()
        self.short_term.set_system_message(settings.personality_prompt)

    async def end_session(self, summary: str = "") -> None:
        """End the current session and save summary."""
        if self._current_conversation_id:
            await self.episodic.end_conversation(
                self._current_conversation_id, summary
            )
            logger.info("Session ended and saved")
