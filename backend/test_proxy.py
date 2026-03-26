import aiohttp
import asyncio
import sys

async def test_proxy():
    print("Testing proxy connection...")
    print(f"Proxy: http://127.0.0.1:1080")
    print(f"Target: https://api.binance.com/api/v3/ping")
    print()

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get('https://api.binance.com/api/v3/ping', proxy='http://127.0.0.1:1080') as response:
                print(f"Status: {response.status}")
                text = await response.text()
                print(f"Response: {text}")
                return True
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    result = asyncio.run(test_proxy())
    sys.exit(0 if result else 1)
