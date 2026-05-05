"""
JARVIS AI Agent — Tools REST Routes
======================================
Endpoints for managing and querying tools.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/tools")
async def list_tools():
    """List all available tools."""
    from interfaces.api.server import get_orchestrator
    orchestrator = get_orchestrator()
    tools = orchestrator.tools.list_tools()
    return {"tools": tools, "count": len(tools)}


@router.get("/tools/{tool_name}")
async def get_tool(tool_name: str):
    """Get a specific tool's schema."""
    from interfaces.api.server import get_orchestrator
    orchestrator = get_orchestrator()
    tool = orchestrator.tools.get(tool_name)
    if not tool:
        return {"error": f"Tool '{tool_name}' not found"}
    return {"tool": tool.get_schema()}
