from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
import asyncio

from app.core.database import get_db, AsyncSessionLocal
from app.schemas.kline import (
    KlineCollectionRequest,
    KlineCollectionResponse,
    KlineDataInfoResponse,
    KlineData,
    ConfigResponse,
    TaskInfoResponse,
    TaskListResponse,
)
from app.services.kline_service import kline_service
from app.services.task_manager import task_manager

router = APIRouter()

CONFIG_SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "BNBUSDT",
    "SOLUSDT",
    "ADAUSDT",
    "XRPUSDT",
    "DOTUSDT",
    "DOGEUSDT",
    "AVAXUSDT",
    "MATICUSDT",
]

CONFIG_INTERVALS = [
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "6h",
    "8h",
    "12h",
    "1d",
    "3d",
    "1w",
    "1M",
]


@router.get("/config", response_model=ConfigResponse)
async def get_config():
    """获取可配置的交易对和K线间隔"""
    return ConfigResponse(symbols=CONFIG_SYMBOLS, intervals=CONFIG_INTERVALS)


@router.post("/kline/collect", response_model=KlineCollectionResponse)
async def collect_kline_data(
    request: KlineCollectionRequest,
):
    """触发K线数据采集（后台异步执行）
    
    同一类型的任务（同交易对+同K线区间）不允许同时执行
    """
    symbol = request.symbol.upper()
    interval = request.interval
    
    print(f"收到采集请求: {symbol} {interval}")
    
    # 检查是否有同类型任务正在执行
    if task_manager.is_task_running(symbol, interval):
        running_task = task_manager.get_running_task_by_type(symbol, interval)
        if running_task:
            print(f"同类型任务正在执行: {running_task.task_id}")
            return KlineCollectionResponse(
                success=False,
                message=f"同类型任务正在执行中 (任务ID: {running_task.task_id})",
                task_id=running_task.task_id,
            )
    
    # 创建新任务
    task_info = task_manager.create_task(symbol, interval)
    if not task_info:
        print("创建任务失败")
        return KlineCollectionResponse(
            success=False,
            message="创建任务失败，同类型任务可能正在执行",
            task_id=None,
        )
    
    print(f"任务创建成功: {task_info.task_id}")
    
    # 启动后台任务
    async def run_task():
        print(f"后台任务开始执行: {task_info.task_id}")
        try:
            async with AsyncSessionLocal() as task_db:
                await kline_service.collect_data_task(
                    db=task_db,
                    symbol=symbol,
                    interval=interval,
                    task_id=task_info.task_id,
                )
        except Exception as e:
            print(f"任务执行异常: {e}")
            import traceback
            traceback.print_exc()
            task_manager.fail_task(task_info.task_id, str(e))
    
    # 标记任务为运行中
    task_manager.start_task(task_info.task_id)
    
    # 创建并启动后台任务
    asyncio.create_task(run_task())
    
    print(f"任务已启动: {task_info.task_id}")
    print("API立即返回")
    return KlineCollectionResponse(
        success=True,
        message=f"任务已创建并开始执行 (任务ID: {task_info.task_id})",
        task_id=task_info.task_id,
    )


@router.get("/tasks", response_model=TaskListResponse)
async def get_tasks(
    symbol: Optional[str] = None,
    interval: Optional[str] = None,
):
    """获取任务列表"""
    tasks = task_manager.get_all_tasks(symbol, interval)
    print(f"获取任务列表，共 {len(tasks)} 个任务")
    for task in tasks:
        print(f"  - {task.task_id}: {task.symbol} {task.interval} {task.status.value}")
    return TaskListResponse(tasks=[task.to_dict() for task in tasks])


@router.get("/tasks/{task_id}", response_model=TaskInfoResponse)
async def get_task(task_id: str):
    """获取单个任务状态"""
    task_info = task_manager.get_task(task_id)
    if not task_info:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_info.to_dict()


@router.get("/kline/info", response_model=KlineDataInfoResponse)
async def get_kline_info(
    symbol: Optional[str] = None,
    interval: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取K线数据信息统计"""
    data = await kline_service.get_kline_data_info(db, symbol, interval)
    return KlineDataInfoResponse(data=data)


@router.get("/kline/{symbol}/{interval}/previous", response_model=List[KlineData])
async def get_previous_klines(
    symbol: str,
    interval: str,
    endTime: int = Query(default=2147483647000, description="时间戳(毫秒)"),
    limit: int = Query(default=1000, le=1000, description="向前获取数量(不得超过1000)"),
    db: AsyncSession = Depends(get_db),
):
    """获取指定时间之前的K线数据"""
    return await kline_service.get_previous_klines(
        db=db, symbol=symbol, interval=interval, end_time=endTime, limit=limit
    )


@router.get("/kline/{symbol}/{interval}/next", response_model=List[KlineData])
async def get_next_klines(
    symbol: str,
    interval: str,
    fromTime: int = Query(default=0, description="时间戳(毫秒)"),
    limit: int = Query(default=1000, le=1000, description="向后获取数量(不得超过1000)"),
    db: AsyncSession = Depends(get_db),
):
    """获取指定时间之后的K线数据"""
    return await kline_service.get_next_klines(
        db=db, symbol=symbol, interval=interval, from_time=fromTime, limit=limit
    )
