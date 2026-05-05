from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

chat_router = APIRouter()

# Keep at most this many messages in session history (user + assistant turns).
# Bounds context size and cost; older messages are dropped from the prompt.
MAX_HISTORY = 20


@chat_router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    orchestrator = websocket.app.state.orchestrator
    history: list[dict] = []
    try:
        while True:
            data = await websocket.receive_json()
            message = (data.get("message") or "").strip()
            if not message:
                continue
            logger.info(f"User: {message}")
            history.append({"role": "user", "content": message})
            try:
                neuron_name, response = await orchestrator.process(history)
            except Exception as e:
                logger.exception("Orchestrator error")
                neuron_name, response = ("error", f"Error procesando el mensaje: {e}")
            history.append({"role": "assistant", "content": response})
            if len(history) > MAX_HISTORY:
                history = history[-MAX_HISTORY:]
            logger.info(f"[{neuron_name}] {response[:80]}...")
            await websocket.send_json(
                {"type": "response", "content": response, "neuron": neuron_name}
            )
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
