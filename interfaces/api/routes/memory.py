"""
JARVIS AI Agent — Memory REST Routes
=======================================
Endpoints for querying memory subsystems.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/memory/status")
async def memory_status():
    """Get memory subsystem status."""
    from interfaces.api.server import get_orchestrator
    orchestrator = get_orchestrator()
    return {
        "short_term": {
            "messages": orchestrator.memory.short_term.message_count,
            "max": orchestrator.memory.short_term.max_messages,
        },
        "long_term": {
            "documents": orchestrator.memory.long_term.count,
            "available": orchestrator.memory.long_term.is_available,
        },
        "session_id": orchestrator.memory.conversation_id,
    }


@router.get("/memory/search")
async def search_memory(q: str = "", limit: int = 5):
    """Search long-term memory."""
    from interfaces.api.server import get_orchestrator
    orchestrator = get_orchestrator()

    if not q:
        return {"results": [], "query": ""}

    results = orchestrator.memory.long_term.search(q, n_results=limit)
    return {"results": results, "query": q}


@router.get("/memory/history")
async def conversation_history(limit: int = 10):
    """Get recent conversation history."""
    from interfaces.api.server import get_orchestrator
    orchestrator = get_orchestrator()

    conversations = await orchestrator.memory.episodic.search_conversations(limit=limit)
    return {"conversations": conversations}
