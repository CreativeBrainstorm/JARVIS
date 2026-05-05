"""
JARVIS AI Agent — Base Tool
==============================
Abstract base class for all JARVIS tools/plugins.
Tools are self-describing and auto-generate their
OpenAI function calling schemas.
"""

from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class ToolParameter(BaseModel):
    """Description of a single tool parameter."""
    name: str
    type: str = "string"
    description: str = ""
    required: bool = True
    enum: list[str] | None = None


class BaseTool(ABC):
    """
    Abstract base class for JARVIS tools.

    Every tool must define:
    - name: unique identifier
    - description: what the tool does (used by LLM)
    - parameters: list of ToolParameter
    - execute(): the actual tool logic
    """

    name: str = ""
    description: str = ""
    parameters: list[ToolParameter] = []
    category: str = "general"

    @abstractmethod
    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """
        Execute the tool with the given arguments.

        Returns:
            Dict with at least 'result' key. May include 'error'.
        """
        ...

    def get_schema(self) -> dict[str, Any]:
        """
        Generate OpenAI-compatible function calling schema.

        Returns the tool description in the format expected by
        the LLM's tool/function calling API.
        """
        properties: dict[str, Any] = {}
        required: list[str] = []

        for param in self.parameters:
            prop: dict[str, str] = {
                "type": param.type,
                "description": param.description,
            }
            if param.enum:
                prop["enum"] = param.enum  # type: ignore
            properties[param.name] = prop

            if param.required:
                required.append(param.name)

        schema: dict[str, Any] = {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": properties,
                },
            },
        }

        if required:
            schema["function"]["parameters"]["required"] = required

        return schema

    def __repr__(self) -> str:
        return f"<Tool: {self.name}>"
