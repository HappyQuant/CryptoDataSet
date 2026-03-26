from typing import Set, Dict, Any
from fastapi import WebSocket, WebSocketDisconnect
import asyncio
import json

active_connections: Set[WebSocket] = set()
progress_data: Dict[str, Dict[str, Any]] = {}


async def broadcast_progress(collection_key: str, progress: Dict[str, Any]):
    """广播采集进度到所有WebSocket连接"""
    progress_data[collection_key] = progress
    if active_connections:
        message = json.dumps({
            "type": "progress",
            "collection_key": collection_key,
            **progress
        })
        for connection in list(active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                pass


async def websocket_endpoint(websocket: WebSocket):
    """WebSocket端点用于推送采集进度"""
    await websocket.accept()
    active_connections.add(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        active_connections.remove(websocket)
    except Exception:
        active_connections.remove(websocket)
