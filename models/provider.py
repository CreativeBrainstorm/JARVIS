"""
JARVIS AI Agent — LLM Provider
================================
Abstraction layer over LiteLLM for multi-provider LLM access
with streaming, tool calling, and automatic fallback.
"""

import json
from typing import Any, AsyncGenerator

import litellm
from loguru import logger

from config.settings import settings


# Suppress LiteLLM's verbose logging
litellm.suppress_debug_info = True
litellm.set_verbose = False


class LLMProvider:
    """
    Unified LLM provider using LiteLLM.

    Supports OpenAI, Anthropic, Gemini, Ollama and any other
    LiteLLM-compatible provider with a single interface.
    """

    def __init__(
        self,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ):
        self.model = model or settings.get_litellm_model()
        self.temperature = temperature or settings.llm_temperature
        self.max_tokens = max_tokens or settings.llm_max_tokens
        logger.info(f"LLM Provider initialized | Model: {self.model}")

    async def chat(
        self,
        messages: list[dict[str, str]],
        tools: list[dict] | None = None,
        tool_choice: str | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """
        Send a chat completion request.

        Args:
            messages: List of message dicts with 'role' and 'content'
            tools: Optional list of tool schemas for function calling
            tool_choice: Tool choice strategy ('auto', 'none', or specific)

        Returns:
            Response dict with 'content', 'tool_calls', and 'usage'
        """
        try:
            params: dict[str, Any] = {
                "model": self.model,
                "messages": messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
                **kwargs,
            }

            if tools:
                params["tools"] = tools
                params["tool_choice"] = tool_choice or "auto"

            response = await litellm.acompletion(**params)
            choice = response.choices[0]

            result: dict[str, Any] = {
                "content": choice.message.content or "",
                "tool_calls": [],
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                },
            }

            # Extract tool calls if present
            if choice.message.tool_calls:
                for tc in choice.message.tool_calls:
                    result["tool_calls"].append({
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": json.loads(tc.function.arguments),
                    })

            return result

        except Exception as e:
            logger.error(f"LLM request failed: {e}")
            raise

    async def chat_stream(
        self,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> AsyncGenerator[str, None]:
        """
        Stream a chat completion response.

        Yields:
            Text chunks as they arrive from the LLM.
        """
        try:
            response = await litellm.acompletion(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                stream=True,
                **kwargs,
            )

            async for chunk in response:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    yield delta.content

        except Exception as e:
            logger.error(f"LLM streaming failed: {e}")
            yield f"\n⚠️ Error: {str(e)}"

    async def simple_completion(self, prompt: str, system: str = "") -> str:
        """Quick single-turn completion helper."""
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        result = await self.chat(messages)
        return result["content"]
