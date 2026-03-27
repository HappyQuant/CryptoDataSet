from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal


class KlineData(BaseModel):
    open_time: int
    close_time: int
    open_price: Decimal
    close_price: Decimal
    high_price: Decimal
    low_price: Decimal
    base_volume: Decimal
    quote_volume: Decimal
    trades_count: int
    taker_buy_base_volume: Decimal
    taker_buy_quote_volume: Decimal
    reserved: Optional[str] = None

    class Config:
        from_attributes = True


class KlineCollectionRequest(BaseModel):
    symbol: str
    interval: str


class KlineCollectionResponse(BaseModel):
    success: bool
    message: str
    task_id: Optional[str] = None


class TaskInfoResponse(BaseModel):
    task_id: str
    task_type: str
    symbol: str
    interval: str
    status: str
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    message_zh: str
    message_en: str
    collected_count: int
    error_message: Optional[str] = None


class TaskListResponse(BaseModel):
    tasks: List[TaskInfoResponse]


class KlineDataInfo(BaseModel):
    symbol: str
    interval: str
    total_count: int
    earliest_time: int
    latest_time: int


class KlineDataInfoResponse(BaseModel):
    data: List[KlineDataInfo]


class ConfigResponse(BaseModel):
    symbols: List[str]
    intervals: List[str]
