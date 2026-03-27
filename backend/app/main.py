from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.api.routes import router
from app.services.task_manager import task_manager
from app.core.middleware import RequestLoggingMiddleware, request_metrics
from app.core.rate_limit import RateLimitMiddleware
from app.core.database import check_database_connection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("应用启动，中断所有之前的任务...")
    task_manager.interrupt_all_tasks()
    logger.info("所有之前的任务已标记为中断")

    yield

    logger.info("应用关闭，中断所有正在运行的任务...")
    task_manager.interrupt_all_tasks()
    logger.info("所有任务已中断")


app = FastAPI(
    title="Crypto Kline Data Service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Crypto Kline Data Service"}


@app.get("/health")
async def health_check():
    db_healthy = await check_database_connection()
    task_stats = {
        "total_tasks": len(task_manager._tasks),
        "running_tasks": sum(
            1 for t in task_manager._tasks.values()
            if t.status.value == "running"
        ),
    }

    status = "healthy" if db_healthy else "degraded"
    return {
        "status": status,
        "database": "connected" if db_healthy else "disconnected",
        "tasks": task_stats,
    }


@app.get("/metrics")
async def get_metrics():
    return {
        "api": request_metrics.get_stats(),
        "tasks": {
            "total": len(task_manager._tasks),
            "running": sum(
                1 for t in task_manager._tasks.values()
                if t.status.value == "running"
            ),
            "completed": sum(
                1 for t in task_manager._tasks.values()
                if t.status.value == "completed"
            ),
            "failed": sum(
                1 for t in task_manager._tasks.values()
                if t.status.value == "failed"
            ),
        },
    }
