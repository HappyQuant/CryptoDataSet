import aiohttp
from typing import List, Dict, Any, Optional
from app.core.config import settings


class BinanceService:
    def __init__(self):
        self.base_url = settings.BINANCE_API_URL

    async def fetch_klines(
        self,
        symbol: str,
        interval: str,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        limit: int = 1000,
    ) -> List[List[Any]]:
        """从Binance获取K线数据"""
        url = f"{self.base_url}/api/v3/klines"
        params = {"symbol": symbol.upper(), "interval": interval, "limit": limit}

        if start_time:
            params["startTime"] = start_time
        if end_time:
            params["endTime"] = end_time

        proxy = settings.BINANCE_PROXY if settings.BINANCE_PROXY else None

        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, proxy=proxy) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    error_text = await response.text()
                    raise Exception(
                        f"Binance API error: {response.status} - {error_text}"
                    )

    def parse_kline_data(self, klines: List[List[Any]]) -> List[Dict[str, Any]]:
        """解析K线数据"""
        parsed_data = []
        for kline in klines:
            parsed_data.append(
                {
                    "open_time": kline[0],
                    "open_price": str(kline[1]),
                    "high_price": str(kline[2]),
                    "low_price": str(kline[3]),
                    "close_price": str(kline[4]),
                    "base_volume": str(kline[5]),
                    "close_time": kline[6],
                    "quote_volume": str(kline[7]),
                    "trades_count": kline[8],
                    "taker_buy_base_volume": str(kline[9]),
                    "taker_buy_quote_volume": str(kline[10]),
                    "reserved": "",
                }
            )
        return parsed_data


binance_service = BinanceService()
