"""
JARVIS AI Agent — Episodic Memory
===================================
SQLite-based storage for conversation history,
providing persistent logs and searchable episodes.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import aiosqlite
from loguru import logger

from utils.helpers import utc_now


class EpisodicMemory:
    """
    Episodic memory using SQLite for conversation history.

    Stores full conversation logs with metadata for
    searching past interactions by date, content, or tags.
    """

    def __init__(self, db_path: str = "./data/sqlite/jarvis.db"):
        self._db_path = db_path
        self._initialized = False

        # Ensure directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    async def initialize(self) -> None:
        """Create database tables if they don't exist."""
        if self._initialized:
            return

        async with aiosqlite.connect(self._db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT DEFAULT '',
                    summary TEXT DEFAULT '',
                    started_at TEXT NOT NULL,
                    ended_at TEXT,
                    message_count INTEGER DEFAULT 0,
                    tags TEXT DEFAULT '[]'
                )
            """)
            await db.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}',
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
                )
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(conversation_id)
            """)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_conversations_started
                ON conversations(started_at)
            """)
            await db.commit()

        self._initialized = True
        logger.info("Episodic memory initialized")

    async def create_conversation(self, title: str = "") -> str:
        """Start a new conversation episode. Returns conversation ID."""
        await self.initialize()
        conv_id = str(uuid.uuid4())

        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO conversations (id, title, started_at) VALUES (?, ?, ?)",
                (conv_id, title, utc_now().isoformat()),
            )
            await db.commit()

        logger.debug(f"Episodic: Created conversation {conv_id[:8]}...")
        return conv_id

    async def store_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a message in a conversation."""
        await self.initialize()

        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "INSERT INTO messages (conversation_id, role, content, timestamp, metadata) VALUES (?, ?, ?, ?, ?)",
                (
                    conversation_id,
                    role,
                    content,
                    utc_now().isoformat(),
                    json.dumps(metadata or {}),
                ),
            )
            await db.execute(
                "UPDATE conversations SET message_count = message_count + 1 WHERE id = ?",
                (conversation_id,),
            )
            await db.commit()

    async def get_conversation(self, conversation_id: str) -> dict[str, Any] | None:
        """Get a conversation with all its messages."""
        await self.initialize()

        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row
            cursor = await db.execute(
                "SELECT * FROM conversations WHERE id = ?",
                (conversation_id,),
            )
            conv = await cursor.fetchone()
            if not conv:
                return None

            cursor = await db.execute(
                "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp",
                (conversation_id,),
            )
            messages = await cursor.fetchall()

            return {
                "id": conv["id"],
                "title": conv["title"],
                "summary": conv["summary"],
                "started_at": conv["started_at"],
                "ended_at": conv["ended_at"],
                "message_count": conv["message_count"],
                "messages": [
                    {
                        "role": m["role"],
                        "content": m["content"],
                        "timestamp": m["timestamp"],
                    }
                    for m in messages
                ],
            }

    async def search_conversations(
        self,
        query: str = "",
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Search past conversations by content."""
        await self.initialize()

        async with aiosqlite.connect(self._db_path) as db:
            db.row_factory = aiosqlite.Row

            if query:
                cursor = await db.execute(
                    """
                    SELECT DISTINCT c.* FROM conversations c
                    JOIN messages m ON c.id = m.conversation_id
                    WHERE m.content LIKE ?
                    ORDER BY c.started_at DESC
                    LIMIT ?
                    """,
                    (f"%{query}%", limit),
                )
            else:
                cursor = await db.execute(
                    "SELECT * FROM conversations ORDER BY started_at DESC LIMIT ?",
                    (limit,),
                )

            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def end_conversation(self, conversation_id: str, summary: str = "") -> None:
        """Mark a conversation as ended."""
        await self.initialize()

        async with aiosqlite.connect(self._db_path) as db:
            await db.execute(
                "UPDATE conversations SET ended_at = ?, summary = ? WHERE id = ?",
                (utc_now().isoformat(), summary, conversation_id),
            )
            await db.commit()
