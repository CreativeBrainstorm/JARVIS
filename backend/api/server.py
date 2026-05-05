from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from loguru import logger
from openai import AsyncOpenAI

from backend.api.chat import chat_router
from backend.config import settings
from backend.core.neuron import load_neurons
from backend.core.orchestrator import Orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    neurons = load_neurons(Path(settings.neurons_path))
    logger.info(f"Loaded {len(neurons)} neuron(s): {list(neurons.keys())}")
    app.state.orchestrator = Orchestrator(client, neurons)
    yield


app = FastAPI(title="JARVIS", lifespan=lifespan)
app.include_router(chat_router, prefix="/api")

frontend_path = Path(__file__).resolve().parent.parent.parent / "frontend"
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
