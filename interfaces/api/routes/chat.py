"""
JARVIS AI Agent — Chat WebSocket Route
=========================================
Real-time chat via WebSocket with streaming support.
"""

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger


router = APIRouter()

# Track connected clients
connected_clients: list[WebSocket] = []


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for real-time chat with JARVIS.

    Protocol:
    - Client sends: {"message": "user text"}
    - Server responds: {"type": "response", "content": "jarvis text"}
    - Server can send: {"type": "status", "content": "processing..."}
    """
    await websocket.accept()
    connected_clients.append(websocket)
    logger.info(f"Client connected | Total: {len(connected_clients)}")

    try:
        # Send welcome message
        await websocket.send_json({
            "type": "response",
            "content": "Good evening, Sir. All systems are operational. How may I assist you?",
        })

        while True:
            # Receive message
            data = await websocket.receive_text()

            try:
                payload = json.loads(data)
                user_message = payload.get("message", "").strip()
            except json.JSONDecodeError:
                user_message = data.strip()

            if not user_message:
                continue

            logger.info(f"WS received: {user_message[:100]}")

            # Send processing status
            await websocket.send_json({
                "type": "status",
                "content": "Processing...",
            })

            # Get orchestrator and process
            from interfaces.api.server import get_orchestrator
            orchestrator = get_orchestrator()
            response = await orchestrator.process_input(user_message)

            # Check for exit
            if response == "__EXIT__":
                await websocket.send_json({
                    "type": "response",
                    "content": "Goodbye, Sir. JARVIS signing off.",
                })
                break

            # Send response
            await websocket.send_json({
                "type": "response",
                "content": response,
            })

    except WebSocketDisconnect:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "content": f"Internal error: {str(e)}",
            })
        except Exception:
            pass
    finally:
        if websocket in connected_clients:
            connected_clients.remove(websocket)
