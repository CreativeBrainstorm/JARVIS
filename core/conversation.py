"""
JARVIS AI Agent — Conversation Engine
========================================
Handles LLM interactions including tool calling loops,
streaming responses, and context management.
"""

import json
from typing import Any, AsyncGenerator

from loguru import logger

from core.state import JarvisState
from memory.manager import MemoryManager
from models.provider import LLMProvider
from models.schemas import ToolCall
from tools.registry import ToolRegistry


class ConversationEngine:
    """
    Core conversation engine for JARVIS.

    Manages the LLM interaction loop:
    1. Build context from memory + tools
    2. Call LLM with tools available
    3. If tool calls → execute → feed results → repeat
    4. Return final response
    """

    def __init__(
        self,
        llm: LLMProvider,
        memory: MemoryManager,
        tool_registry: ToolRegistry,
    ):
        self.llm = llm
        self.memory = memory
        self.tools = tool_registry
        self._max_tool_iterations = 5
        logger.debug("Conversation Engine initialized")

    async def process(self, user_input: str) -> str:
        """
        Process a user message and return JARVIS's response.

        Handles the full tool-calling loop if needed.

        Args:
            user_input: The user's message

        Returns:
            JARVIS's text response
        """
        # Record user message
        await self.memory.add_user_message(user_input)

        # Get conversation context
        messages = self.memory.get_context_messages()

        # Search for relevant knowledge
        context = await self.memory.search_knowledge(user_input)
        if context:
            # Inject retrieved knowledge before the latest user message
            knowledge_msg = {
                "role": "system",
                "content": f"[Relevant context from memory]\n{context}",
            }
            messages.insert(-1, knowledge_msg)

        # Get tool schemas
        tool_schemas = self.tools.get_schemas() if self.tools.count > 0 else None

        # LLM interaction loop (handles tool calls)
        iterations = 0
        while iterations < self._max_tool_iterations:
            iterations += 1

            try:
                result = await self.llm.chat(
                    messages=messages,
                    tools=tool_schemas,
                )
            except Exception as e:
                error_msg = f"I apologize, Sir. I'm experiencing a technical difficulty: {str(e)}"
                logger.error(f"LLM call failed: {e}")
                await self.memory.add_assistant_message(error_msg)
                return error_msg

            # If no tool calls, we have our final response
            if not result["tool_calls"]:
                response = result["content"]
                await self.memory.add_assistant_message(response)
                return response

            # Process tool calls
            logger.info(f"Processing {len(result['tool_calls'])} tool call(s)...")

            # Add assistant message with tool calls to context
            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": result["content"] or "",
            }

            # Format tool_calls for the API
            assistant_msg["tool_calls"] = [
                {
                    "id": tc["id"],
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": json.dumps(tc["arguments"]),
                    },
                }
                for tc in result["tool_calls"]
            ]
            messages.append(assistant_msg)

            # Execute each tool and add results
            for tc in result["tool_calls"]:
                tool_call = ToolCall(
                    id=tc["id"],
                    name=tc["name"],
                    arguments=tc["arguments"],
                )
                tool_result = await self.tools.execute(tool_call)

                # Add tool result message
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(
                        tool_result.result if tool_result.success
                        else {"error": tool_result.error}
                    ),
                })

        # If we exhausted iterations
        fallback = "I've completed multiple operations. Is there anything specific you'd like me to clarify?"
        await self.memory.add_assistant_message(fallback)
        return fallback

    async def process_stream(self, user_input: str) -> AsyncGenerator[str, None]:
        """
        Process a user message with streaming response.

        Yields:
            Text chunks as they arrive.
        """
        await self.memory.add_user_message(user_input)
        messages = self.memory.get_context_messages()

        full_response = ""
        async for chunk in self.llm.chat_stream(messages=messages):
            full_response += chunk
            yield chunk

        await self.memory.add_assistant_message(full_response)
