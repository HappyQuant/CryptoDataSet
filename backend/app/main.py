from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.websocket_manager import websocket_endpoint
from typing import Set
import asyncio

app = FastAPI(title="Crypto Kline Data Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Crypto Kline Data Service"}

@app.websocket("/ws/progress")
async def ws_endpoint(websocket: WebSocket):
    await websocket_endpoint(websocket)
