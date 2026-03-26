import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.services.binance_service import binance_service
import asyncio
import pprint

async def test_collect():
    print("=" * 50)
    print("Testing Binance Kline Collection")
    print("=" * 50)
    print()
    print("Settings:")
    print(f"  BINANCE_API_URL: {settings.BINANCE_API_URL}")
    print(f"  BINANCE_PROXY: {settings.BINANCE_PROXY}")
    print()

    print("Calling fetch_klines...")
    try:
        result = await binance_service.fetch_klines(
            symbol="BTCUSDT",
            interval="1m",
            limit=1
        )
        print(f"Success! Got {len(result)} klines")
        if result:
            print(f"First kline: {result[0]}")
        return True
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_collect())
    sys.exit(0 if result else 1)
