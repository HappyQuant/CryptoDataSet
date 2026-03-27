import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable, Dict, Tuple
from collections import defaultdict
import asyncio


class RateLimiter:
    def __init__(self, requests_per_minute: int = 60, requests_per_hour: int = 1000):
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self._minute_requests: Dict[str, list] = defaultdict(list)
        self._hour_requests: Dict[str, list] = defaultdict(list)
        self._cleanup_task = None

    def _cleanup_old_entries(self):
        current_time = time.time()
        one_minute_ago = current_time - 60
        one_hour_ago = current_time - 3600

        for key in list(self._minute_requests.keys()):
            self._minute_requests[key] = [
                t for t in self._minute_requests[key] if t > one_minute_ago
            ]
            if not self._minute_requests[key]:
                del self._minute_requests[key]

        for key in list(self._hour_requests.keys()):
            self._hour_requests[key] = [
                t for t in self._hour_requests[key] if t > one_hour_ago
            ]
            if not self._hour_requests[key]:
                del self._hour_requests[key]

    async def check_rate_limit(self, client_id: str) -> Tuple[bool, dict]:
        current_time = time.time()

        self._cleanup_old_entries()

        minute_count = len(self._minute_requests.get(client_id, []))
        hour_count = len(self._hour_requests.get(client_id, []))

        if minute_count >= self.requests_per_minute:
            retry_after = 60 - (current_time - min(self._minute_requests[client_id]))
            return False, {
                "error": "Rate limit exceeded",
                "limit": self.requests_per_minute,
                "window": "1 minute",
                "retry_after": int(retry_after) + 1,
            }

        if hour_count >= self.requests_per_hour:
            retry_after = 3600 - (current_time - min(self._hour_requests[client_id]))
            return False, {
                "error": "Rate limit exceeded",
                "limit": self.requests_per_hour,
                "window": "1 hour",
                "retry_after": int(retry_after) + 1,
            }

        self._minute_requests[client_id].append(current_time)
        self._hour_requests[client_id].append(current_time)

        return True, {
            "limit": self.requests_per_minute,
            "remaining": self.requests_per_minute - minute_count - 1,
            "reset": int(current_time) + 60,
        }


rate_limiter = RateLimiter(requests_per_minute=60, requests_per_hour=1000)


class RateLimitMiddleware(BaseHTTPMiddleware):
    EXCLUDED_PATHS = ["/", "/health", "/metrics", "/docs", "/openapi.json", "/redoc"]

    async def dispatch(self, request: Request, call_next: Callable):
        if request.url.path in self.EXCLUDED_PATHS or request.url.path.startswith("/docs"):
            return await call_next(request)

        client_id = request.client.host if request.client else "unknown"

        is_allowed, rate_info = await rate_limiter.check_rate_limit(client_id)

        if not is_allowed:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=429,
                content={"detail": rate_info["error"], "retry_after": rate_info["retry_after"]},
                headers={
                    "X-RateLimit-Limit": str(rate_info["limit"]),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(rate_info["retry_after"]),
                },
            )

        response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
        response.headers["X-RateLimit-Remaining"] = str(rate_info.get("remaining", 0))
        response.headers["X-RateLimit-Reset"] = str(rate_info["reset"])

        return response
