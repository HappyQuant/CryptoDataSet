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
    start_time: Optional[int] = None
    end_time: Optional[int] = None


class KlineCollectionResponse(BaseModel):
    success: bool
    message: str
    collected_count: int = 0


class KlineDataInfo(BaseModel):
    symbol: str
    interval: str
    total_count: int
    earliest_time: Optional[int] = None
    latest_time: Optional[int] = None


class KlineDataInfoResponse(BaseModel):
    data: List[KlineDataInfo]


class ConfigResponse(BaseModel):
    symbols: List[str]
    intervals: List[str]
