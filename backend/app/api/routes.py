from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Dict, Any
import time
import json

from app.core.database import get_db
from app.schemas.kline import (
    KlineCollectionRequest,
    KlineCollectionResponse,
    KlineDataInfoResponse,
    KlineData,
    ConfigResponse,
)
from app.services.kline_service import kline_service
from app.core.websocket_manager import broadcast_progress

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
    db: AsyncSession = Depends(get_db),
):
    """触发K线数据采集"""
    collection_key = f"{request.symbol}_{request.interval}"
    
    try:
        async def progress_callback(collected_count, current_start, end_time):
            progress = {
                "collected_count": collected_count,
                "current_start": current_start,
                "end_time": end_time,
                "progress_percent": round((current_start / end_time) * 100, 2) if end_time > 0 else 0,
                "current_time_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(current_start / 1000)),
                "end_time_str": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(end_time / 1000)),
            }
            await broadcast_progress(collection_key, progress)
        
        count = await kline_service.collect_kline_data(
            db=db,
            symbol=request.symbol,
            interval=request.interval,
            start_time=request.start_time,
            end_time=request.end_time,
            progress_callback=progress_callback,
        )
        
        return KlineCollectionResponse(
            success=True,
            message=f"Successfully collected {count} kline records",
            collected_count=count,
        )
    except Exception as e:
        return KlineCollectionResponse(success=False, message=str(e), collected_count=0)


@router.get("/kline/collect/status", response_model=Dict[str, Any])
async def get_collection_status():
    """获取采集任务状态"""
    from app.core.websocket_manager import progress_data
    return {
        "active_collections": progress_data,
        "total_active": len(progress_data),
    }


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
