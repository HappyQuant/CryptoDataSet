from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Any, Optional
from app.models.kline import get_kline_table, create_kline_table
from app.schemas.kline import KlineData, KlineDataInfo
from app.services.binance_service import binance_service


class KlineService:

    async def collect_kline_data(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        progress_callback=None,
    ) -> int:
        """采集K线数据"""
        await create_kline_table(symbol, interval)
        table = get_kline_table(symbol, interval)

        collected_count = 0
        current_start = start_time

        if not end_time:
            import time

            end_time = int(time.time() * 1000)

        while current_start is None or current_start < end_time:
            try:
                klines = await binance_service.fetch_klines(
                    symbol=symbol,
                    interval=interval,
                    start_time=current_start,
                    end_time=end_time,
                    limit=1000,
                )

                if not klines:
                    break

                parsed_data = binance_service.parse_kline_data(klines)

                for data in parsed_data:
                    # 先查询是否存在
                    existing = await db.execute(
                        select(table).where(table.c.open_time == data['open_time'])
                    )
                    if existing.scalar_one_or_none() is None:
                        stmt = insert(table).values(**data)
                        await db.execute(stmt)

                await db.commit()
                collected_count += len(parsed_data)

                last_kline = klines[-1]
                current_start = last_kline[6] + 1

                if progress_callback:
                    await progress_callback(collected_count, current_start, end_time)

                if len(klines) < 1000:
                    break

            except Exception as e:
                await db.rollback()
                raise e

        return collected_count

    async def get_kline_data_info(
        self,
        db: AsyncSession,
        symbol: Optional[str] = None,
        interval: Optional[str] = None,
    ) -> List[KlineDataInfo]:
        from sqlalchemy import inspect, text
        from app.core.database import engine

        async with engine.connect() as conn:
            result = await conn.execute(
                text(
                    """
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE 't_kline_%'
            """
                )
            )
            tables = result.fetchall()

        data_info_list = []

        for (table_name,) in tables:
            parts = table_name.replace("t_kline_", "").split("_")
            if len(parts) >= 2:
                table_symbol = parts[0].upper()
                table_interval = "_".join(parts[1:])

                if symbol and table_symbol != symbol.upper():
                    continue
                if interval and table_interval != interval:
                    continue

                table = get_kline_table(table_symbol, table_interval)

                async with engine.connect() as conn:
                    result = await conn.execute(
                        select(
                            func.count(table.c.open_time).label("total_count"),
                            func.min(table.c.open_time).label("earliest_time"),
                            func.max(table.c.close_time).label("latest_time"),
                        )
                    )
                    row = result.fetchone()

                    if row and row.total_count > 0:
                        data_info_list.append(
                            KlineDataInfo(
                                symbol=table_symbol,
                                interval=table_interval,
                                total_count=row.total_count,
                                earliest_time=row.earliest_time,
                                latest_time=row.latest_time,
                            )
                        )

        return data_info_list

    async def get_previous_klines(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
        end_time: int,
        limit: int = 1000,
    ) -> List[KlineData]:
        """获取指定时间之前的K线数据"""
        table = get_kline_table(symbol, interval)
        
        result = await db.execute(
            select(table)
            .where(table.c.open_time < end_time)
            .order_by(desc(table.c.open_time))
            .limit(limit)
        )
        
        rows = result.fetchall()
        
        kline_data_list = []
        for row in reversed(rows):  # 反转顺序，按时间升序返回
            kline_data_list.append(KlineData(
                open_time=row.open_time,
                close_time=row.close_time,
                open_price=row.open_price,
                close_price=row.close_price,
                high_price=row.high_price,
                low_price=row.low_price,
                base_volume=row.base_volume,
                quote_volume=row.quote_volume,
                trades_count=row.trades_count,
                taker_buy_base_volume=row.taker_buy_base_volume,
                taker_buy_quote_volume=row.taker_buy_quote_volume,
            ))
        
        return kline_data_list

    async def get_next_klines(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
        from_time: int,
        limit: int = 1000,
    ) -> List[KlineData]:
        """获取指定时间之后的K线数据"""
        table = get_kline_table(symbol, interval)
        
        result = await db.execute(
            select(table)
            .where(table.c.open_time > from_time)
            .order_by(asc(table.c.open_time))
            .limit(limit)
        )
        
        rows = result.fetchall()
        
        kline_data_list = []
        for row in rows:
            kline_data_list.append(KlineData(
                open_time=row.open_time,
                close_time=row.close_time,
                open_price=row.open_price,
                close_price=row.close_price,
                high_price=row.high_price,
                low_price=row.low_price,
                base_volume=row.base_volume,
                quote_volume=row.quote_volume,
                trades_count=row.trades_count,
                taker_buy_base_volume=row.taker_buy_base_volume,
                taker_buy_quote_volume=row.taker_buy_quote_volume,
            ))
        
        return kline_data_list


kline_service = KlineService()
