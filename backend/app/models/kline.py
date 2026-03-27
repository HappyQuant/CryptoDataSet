from sqlalchemy import Column, BigInteger, Numeric, Integer, String, Table, MetaData, Index
from sqlalchemy.orm import declarative_base
from app.core.database import Base, engine

metadata = MetaData()

def get_kline_table(symbol: str, interval: str):
    """动态获取或创建K线数据表"""
    table_name = f"t_kline_{symbol.lower()}_{interval}"

    indexes = [
        Index(f'idx_{table_name}_open_time', 'open_time'),
        Index(f'idx_{table_name}_close_time', 'close_time'),
    ]

    table = Table(
        table_name,
        metadata,
        Column("open_time", BigInteger, primary_key=True),
        Column("close_time", BigInteger),
        Column("open_price", Numeric(32, 16)),
        Column("close_price", Numeric(32, 16)),
        Column("high_price", Numeric(32, 16)),
        Column("low_price", Numeric(32, 16)),
        Column("base_volume", Numeric(32, 16)),
        Column("quote_volume", Numeric(32, 16)),
        Column("trades_count", Integer),
        Column("taker_buy_base_volume", Numeric(32, 16)),
        Column("taker_buy_quote_volume", Numeric(32, 16)),
        Column("reserved", String(64)),
        *indexes,
        extend_existing=True
    )

    return table

async def create_kline_table(symbol: str, interval: str):
    """异步创建K线数据表"""
    table = get_kline_table(symbol, interval)
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all, tables=[table])
    return table
