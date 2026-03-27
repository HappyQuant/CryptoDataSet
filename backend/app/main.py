from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import router
from app.services.task_manager import task_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时：中断所有之前的任务（程序重启后）
    print("应用启动，中断所有之前的任务...")
    task_manager.interrupt_all_tasks()
    print("所有之前的任务已标记为中断")
    
    yield
    
    # 关闭时：中断所有正在运行的任务
    print("应用关闭，中断所有正在运行的任务...")
    task_manager.interrupt_all_tasks()
    print("所有任务已中断")


app = FastAPI(
    title="Crypto Kline Data Service",
    version="1.0.0",
    lifespan=lifespan,
)

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
