"""
JARVIS AI Agent — Tool Registry
==================================
Dynamic tool registry with auto-discovery, execution,
and schema serialization for the LLM.
"""

import time
from typing import Any

from loguru import logger

from models.schemas import ToolCall, ToolResult
from tools.base import BaseTool


class ToolRegistry:
    """
    Central registry for all JARVIS tools.

    Handles registration, discovery, execution, and
    schema generation for the LLM tool calling API.
    """

    def __init__(self):
        self._tools: dict[str, BaseTool] = {}
        logger.debug("Tool Registry initialized")

    def register(self, tool: BaseTool) -> None:
        """Register a tool instance."""
        if tool.name in self._tools:
            logger.warning(f"Tool '{tool.name}' already registered — overwriting")
        self._tools[tool.name] = tool
        logger.info(f"🔧 Registered tool: {tool.name} ({tool.category})")

    def unregister(self, name: str) -> bool:
        """Unregister a tool by name."""
        if name in self._tools:
            del self._tools[name]
            logger.info(f"Unregistered tool: {name}")
            return True
        return False

    def get(self, name: str) -> BaseTool | None:
        """Get a tool by name."""
        return self._tools.get(name)

    def list_tools(self) -> list[dict[str, str]]:
        """List all registered tools with their descriptions."""
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "category": tool.category,
            }
            for tool in self._tools.values()
        ]

    def get_schemas(self) -> list[dict[str, Any]]:
        """Get all tool schemas for LLM function calling."""
        return [tool.get_schema() for tool in self._tools.values()]

    async def execute(self, tool_call: ToolCall) -> ToolResult:
        """
        Execute a tool call and return the result.

        Args:
            tool_call: The ToolCall from the LLM

        Returns:
            ToolResult with the execution outcome
        """
        tool = self._tools.get(tool_call.name)
        if not tool:
            logger.error(f"Tool not found: {tool_call.name}")
            return ToolResult(
                tool_call_id=tool_call.id,
                name=tool_call.name,
                result=None,
                success=False,
                error=f"Tool '{tool_call.name}' not found. Available: {list(self._tools.keys())}",
            )

        start = time.perf_counter()
        try:
            logger.info(f"⚡ Executing tool: {tool_call.name} | Args: {tool_call.arguments}")
            result = await tool.execute(**tool_call.arguments)
            elapsed = time.perf_counter() - start

            logger.info(f"✅ Tool {tool_call.name} completed in {elapsed:.3f}s")
            return ToolResult(
                tool_call_id=tool_call.id,
                name=tool_call.name,
                result=result,
                success=True,
                execution_time=elapsed,
            )

        except Exception as e:
            elapsed = time.perf_counter() - start
            logger.error(f"❌ Tool {tool_call.name} failed: {e}")
            return ToolResult(
                tool_call_id=tool_call.id,
                name=tool_call.name,
                result=None,
                success=False,
                error=str(e),
                execution_time=elapsed,
            )

    @property
    def count(self) -> int:
        """Number of registered tools."""
        return len(self._tools)

    def load_default_tools(self) -> None:
        """Load all built-in tools."""
        from tools.datetime_tool.datetime_tool import DateTimeTool
        from tools.system_monitor.monitor import SystemMonitorTool

        self.register(DateTimeTool())
        self.register(SystemMonitorTool())

        logger.info(f"Loaded {self.count} default tools")
