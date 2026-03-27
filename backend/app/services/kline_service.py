from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, asc
from sqlalchemy.dialects.postgresql import insert
from typing import List, Dict, Any, Optional, Tuple
from app.models.kline import get_kline_table, create_kline_table
from app.schemas.kline import KlineData, KlineDataInfo
from app.services.binance_service import binance_service
from app.services.task_manager import task_manager, TaskStatus


# K线间隔对应的毫秒数
INTERVAL_MS = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '2h': 2 * 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '8h': 8 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
    '3d': 3 * 24 * 60 * 60 * 1000,
    '1w': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,  # 约等于30天
}


class KlineService:

    async def get_latest_time(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
    ) -> Optional[int]:
        """获取数据库中最新数据的时间戳"""
        try:
            table = get_kline_table(symbol, interval)
            result = await db.execute(
                select(func.max(table.c.open_time).label("latest_time"))
            )
            row = result.fetchone()
            return row.latest_time if row and row.latest_time else None
        except Exception:
            return None

    async def get_earliest_time(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
    ) -> Optional[int]:
        """获取数据库中最早数据的时间戳"""
        try:
            table = get_kline_table(symbol, interval)
            result = await db.execute(
                select(func.min(table.c.open_time).label("earliest_time"))
            )
            row = result.fetchone()
            return row.earliest_time if row and row.earliest_time else None
        except Exception:
            return None

    def get_interval_ms(self, interval: str) -> int:
        """获取K线间隔对应的毫秒数"""
        return INTERVAL_MS.get(interval, 60 * 1000)  # 默认1分钟

    async def analyze_data_gaps(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
    ) -> List[Tuple[int, int]]:
        """分析数据表，找出漏采的数据区间并优化
        
        Returns:
            List[Tuple[int, int]]: 优化后的漏采时间区间列表
        """
        await create_kline_table(symbol, interval)
        table = get_kline_table(symbol, interval)
        interval_ms = self.get_interval_ms(interval)
        
        # 获取数据库中数据的实际范围
        earliest = await self.get_earliest_time(db, symbol, interval)
        latest = await self.get_latest_time(db, symbol, interval)
        
        if not earliest or not latest:
            print("数据库为空，无需分析漏采区间")
            return []
        
        print(f"数据库数据范围: {earliest} ~ {latest}")
        
        # 查询该时间范围内所有数据点，按时间排序
        result = await db.execute(
            select(table.c.open_time)
            .where(table.c.open_time >= earliest)
            .where(table.c.open_time <= latest)
            .order_by(asc(table.c.open_time))
        )
        existing_times = [row[0] for row in result.fetchall()]
        
        if not existing_times:
            return []
        
        # 检测断档
        gaps = []
        
        for i in range(1, len(existing_times)):
            prev_time = existing_times[i - 1]
            curr_time = existing_times[i]
            expected_diff = interval_ms
            actual_diff = curr_time - prev_time
            
            # 如果实际间隔大于预期间隔的1.5倍，认为有断档
            if actual_diff > expected_diff * 1.5:
                gap_start = prev_time + expected_diff
                gap_end = curr_time - expected_diff
                gaps.append((gap_start, gap_end))
                print(f"发现断档: {gap_start} ~ {gap_end} (间隔 {actual_diff}ms, 预期 {expected_diff}ms)")
        
        # 优化：合并相邻的小断档，提升补采效率
        if gaps:
            merged_gaps = self._merge_gaps(gaps, interval_ms)
            print(f"原始 {len(gaps)} 个断档，合并后 {len(merged_gaps)} 个")
            return merged_gaps
        
        print(f"共发现 {len(gaps)} 个漏采区间")
        return gaps
    
    def _merge_gaps(self, gaps: List[Tuple[int, int]], interval_ms: int) -> List[Tuple[int, int]]:
        """合并相邻的小断档
        
        如果两个断档之间的距离小于1000个间隔，合并成一个大断档
        这样可以减少API请求次数，提升效率
        """
        if len(gaps) <= 1:
            return gaps
        
        merged = []
        current_start, current_end = gaps[0]
        
        for next_start, next_end in gaps[1:]:
            # 计算当前断档结束到下一个断档开始的距离
            gap_between = next_start - current_end
            
            # 如果距离小于1000个间隔，合并
            if gap_between < interval_ms * 1000:
                current_end = next_end
                print(f"合并断档: ({current_start}, {current_end})")
            else:
                merged.append((current_start, current_end))
                current_start, current_end = next_start, next_end
        
        merged.append((current_start, current_end))
        return merged

    async def collect_data_task(
        self,
        db: AsyncSession,
        symbol: str,
        interval: str,
        task_id: str,
    ):
        """后台执行的数据采集任务"""
        try:
            await create_kline_table(symbol, interval)
            table = get_kline_table(symbol, interval)
            interval_ms = self.get_interval_ms(interval)
            
            total_collected = 0
            import time
            
            # 第一步：从2000年开始，采集10根K线
            print("=== 第一步：从2000年开始采集10根K线 ===")
            
            # 2000年1月1日的时间戳（毫秒）
            start_2000 = 946684800000
            
            # 采集10根K线
            klines = await binance_service.fetch_klines(
                symbol=symbol,
                interval=interval,
                start_time=start_2000,
                limit=10,
            )
            
            if not klines or len(klines) == 0:
                print("从2000年开始采集失败，无法获取数据")
                task_manager.fail_task(task_id, "从2000年开始采集失败")
                return
            
            parsed_data = binance_service.parse_kline_data(klines)
            print(f"从2000年开始采集到 {len(parsed_data)} 条数据")
            
            # 插入这10条数据
            inserted_count = 0
            for data in parsed_data:
                stmt = insert(table).values(**data).on_conflict_do_nothing(
                    index_elements=['open_time']
                )
                result = await db.execute(stmt)
                if result.rowcount > 0:
                    inserted_count += 1
            
            await db.commit()
            total_collected += inserted_count
            print(f"插入了 {inserted_count} 条初始数据")
            
            # 获取这10条数据中第一条的时间作为分析起始点
            analyze_start_time = parsed_data[0]['open_time']
            print(f"分析起始点时间: {analyze_start_time} ({time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(analyze_start_time / 1000))})")
            
            # 更新任务进度
            task_manager.update_task_progress(
                task_id, 
                total_collected, 
                f"初始采集完成，开始分析断档"
            )
            
            # 第二步：分析从起始点到当前时间的断档
            print("=== 第二步：分析断档 ===")
            
            current_time = int(time.time() * 1000)
            
            # 获取数据库中数据的实际范围
            earliest = await self.get_earliest_time(db, symbol, interval)
            latest = await self.get_latest_time(db, symbol, interval)
            
            if not earliest or not latest:
                print("数据库为空，直接从起始点开始采集到当前时间")
                # 如果数据库为空，直接采集到当前时间
                current_start = analyze_start_time
                
                while current_start < current_time:
                    if not task_manager.is_task_running_by_id(task_id):
                        print(f"任务 {task_id} 已停止")
                        return
                    
                    try:
                        klines = await binance_service.fetch_klines(
                            symbol=symbol,
                            interval=interval,
                            start_time=current_start,
                            limit=1000,
                        )
                        
                        if not klines or len(klines) == 0:
                            break
                        
                        parsed_data = binance_service.parse_kline_data(klines)
                        inserted_count = 0
                        for data in parsed_data:
                            stmt = insert(table).values(**data).on_conflict_do_nothing(
                                index_elements=['open_time']
                            )
                            result = await db.execute(stmt)
                            if result.rowcount > 0:
                                inserted_count += 1
                        
                        await db.commit()
                        total_collected += inserted_count
                        
                        task_manager.update_task_progress(
                            task_id, 
                            total_collected, 
                            f"采集中，已采集 {total_collected} 条"
                        )
                        
                        last_time = parsed_data[-1]['open_time']
                        if last_time >= current_time - 60000:
                            break
                        if len(klines) < 1000:
                            break
                        current_start = last_time + 1
                        
                    except Exception as e:
                        await db.rollback()
                        print(f"采集失败: {e}")
                        task_manager.fail_task(task_id, str(e))
                        return
            else:
                # 数据库有数据，分析断档
                print(f"数据库数据范围: {earliest} ~ {latest}")
                
                # 查询该时间范围内所有数据点，按时间排序
                result = await db.execute(
                    select(table.c.open_time)
                    .where(table.c.open_time >= analyze_start_time)
                    .where(table.c.open_time <= current_time)
                    .order_by(asc(table.c.open_time))
                )
                existing_times = [row[0] for row in result.fetchall()]
                
                # 检测断档
                gaps = []
                if existing_times:
                    for i in range(1, len(existing_times)):
                        prev_time = existing_times[i - 1]
                        curr_time = existing_times[i]
                        actual_diff = curr_time - prev_time
                        
                        if actual_diff > interval_ms * 1.5:
                            gap_start = prev_time + interval_ms
                            gap_end = curr_time - interval_ms
                            gaps.append((gap_start, gap_end))
                            print(f"发现断档: {gap_start} ~ {gap_end}")
                    
                    # 检查最后一条数据到当前时间是否需要继续采集
                    last_db_time = existing_times[-1]
                    if last_db_time < current_time - interval_ms:
                        gaps.append((last_db_time + interval_ms, current_time))
                        print(f"发现末尾断档: {last_db_time + interval_ms} ~ {current_time}")
                
                # 合并小断档
                if gaps:
                    gaps = self._merge_gaps(gaps, interval_ms)
                
                print(f"共发现 {len(gaps)} 个断档区间")
                
                # 第三步：补采断档
                print("=== 第三步：补采断档 ===")
                
                for i, (gap_start, gap_end) in enumerate(gaps, 1):
                    if not task_manager.is_task_running_by_id(task_id):
                        print(f"任务 {task_id} 已停止")
                        return
                    
                    from datetime import datetime
                    start_str = datetime.fromtimestamp(gap_start / 1000).strftime('%Y-%m-%d %H:%M:%S')
                    end_str = datetime.fromtimestamp(gap_end / 1000).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"正在补采第 {i}/{len(gaps)} 个区间: {start_str} ~ {end_str}")
                    
                    current_start = gap_start
                    gap_collected = 0
                    
                    while current_start <= gap_end:
                        if not task_manager.is_task_running_by_id(task_id):
                            return
                        
                        try:
                            klines = await binance_service.fetch_klines(
                                symbol=symbol,
                                interval=interval,
                                start_time=current_start,
                                end_time=gap_end,
                                limit=1000,
                            )
                            
                            if not klines or len(klines) == 0:
                                break
                            
                            parsed_data = binance_service.parse_kline_data(klines)
                            
                            inserted_count = 0
                            for data in parsed_data:
                                stmt = insert(table).values(**data).on_conflict_do_nothing(
                                    index_elements=['open_time']
                                )
                                result = await db.execute(stmt)
                                if result.rowcount > 0:
                                    inserted_count += 1
                            
                            await db.commit()
                            gap_collected += inserted_count
                            total_collected += inserted_count
                            
                            task_manager.update_task_progress(
                                task_id, 
                                total_collected, 
                                f"补采第 {i}/{len(gaps)} 个区间，已采集 {total_collected} 条"
                            )
                            
                            if len(klines) < 1000:
                                break
                            
                            last_time = klines[-1][0]
                            current_start = last_time + 1
                            
                        except Exception as e:
                            await db.rollback()
                            print(f"补采失败: {e}")
                            break
                    
                    print(f"断档补采完成，插入 {gap_collected} 条数据")
            
            # 任务完成
            task_manager.complete_task(task_id, total_collected, f"采集完成，共 {total_collected} 条")
            print(f"任务 {task_id} 完成，共采集 {total_collected} 条")

        except Exception as e:
            print(f"任务 {task_id} 失败: {e}")
            import traceback
            traceback.print_exc()
            task_manager.fail_task(task_id, str(e))

    async def get_kline_data_info(
        self,
        db: AsyncSession,
        symbol: Optional[str] = None,
        interval: Optional[str] = None,
    ) -> List[KlineDataInfo]:
        from sqlalchemy import text
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
