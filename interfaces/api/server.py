"""
JARVIS AI Agent — FastAPI Server
===================================
Main FastAPI application serving the WebSocket chat,
REST endpoints, and the static Web HUD frontend.
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from loguru import logger

from config.settings import settings
from core.orchestrator import JarvisOrchestrator
from interfaces.api.routes.chat import router as chat_router
from interfaces.api.routes.tools import router as tools_router
from interfaces.api.routes.memory import router as memory_router


# Global orchestrator instance
orchestrator: JarvisOrchestrator | None = None


def get_orchestrator() -> JarvisOrchestrator:
    """Get the global orchestrator instance."""
    global orchestrator
    if orchestrator is None:
        raise RuntimeError("JARVIS not initialized")
    return orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — startup and shutdown."""
    global orchestrator
    logger.info("🚀 Starting JARVIS server...")

    # Initialize orchestrator
    orchestrator = JarvisOrchestrator()
    await orchestrator.initialize()

    logger.info(f"🤖 JARVIS server ready at http://{settings.host}:{settings.port}")
    yield

    # Shutdown
    if orchestrator:
        await orchestrator.shutdown()
    logger.info("Server shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="JARVIS AI Agent",
    description="Personal AI Assistant API",
    version=settings.agent_version,
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(tools_router, prefix="/api", tags=["tools"])
app.include_router(memory_router, prefix="/api", tags=["memory"])

# Serve static frontend files
WEB_DIR = Path(__file__).parent.parent / "web"
if WEB_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_frontend():
    """Serve the main Web HUD page."""
    index_path = WEB_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "JARVIS API is running. Web HUD not found."}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "online",
        "agent": settings.agent_name,
        "version": settings.agent_version,
        "model": settings.llm_model,
    }
