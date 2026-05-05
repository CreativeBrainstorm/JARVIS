from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

chat_router = APIRouter()


@chat_router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    orchestrator = websocket.app.state.orchestrator
    try:
        while True:
            data = await websocket.receive_json()
            message = (data.get("message") or "").strip()
            if not message:
                continue
            logger.info(f"User: {message}")
            try:
                response = await orchestrator.process(message)
            except Exception as e:
                logger.exception("Orchestrator error")
                response = f"Error procesando el mensaje: {e}"
            logger.info(f"JARVIS: {response[:80]}...")
            await websocket.send_json({"type": "response", "content": response})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
