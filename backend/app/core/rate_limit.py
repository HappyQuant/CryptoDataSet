import time
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable, Dict, Tuple
from collections import defaultdict


class RateLimiter:
    def __init__(self, requests_per_second: int = 30, requests_per_minute: int = 1000):
        self.requests_per_second = requests_per_second
        self.requests_per_minute = requests_per_minute
        self._second_requests: Dict[str, list] = defaultdict(list)
        self._minute_requests: Dict[str, list] = defaultdict(list)

    def _cleanup_old_entries(self):
        current_time = time.time()
        one_second_ago = current_time - 1
        one_minute_ago = current_time - 60

        for key in list(self._second_requests.keys()):
            self._second_requests[key] = [
                t for t in self._second_requests[key] if t > one_second_ago
            ]
            if not self._second_requests[key]:
                del self._second_requests[key]

        for key in list(self._minute_requests.keys()):
            self._minute_requests[key] = [
                t for t in self._minute_requests[key] if t > one_minute_ago
            ]
            if not self._minute_requests[key]:
                del self._minute_requests[key]

    async def check_rate_limit(self, client_id: str) -> Tuple[bool, dict]:
        current_time = time.time()

        self._cleanup_old_entries()

        second_count = len(self._second_requests.get(client_id, []))
        minute_count = len(self._minute_requests.get(client_id, []))

        if second_count >= self.requests_per_second:
            retry_after = 1 - (current_time - min(self._second_requests[client_id])) if self._second_requests.get(client_id) else 1
            return False, {
                "error": "Rate limit exceeded",
                "limit": self.requests_per_second,
                "window": "1 second",
                "retry_after": int(retry_after) + 1,
            }

        if minute_count >= self.requests_per_minute:
            retry_after = 60 - (current_time - min(self._minute_requests[client_id])) if self._minute_requests.get(client_id) else 60
            return False, {
                "error": "Rate limit exceeded",
                "limit": self.requests_per_minute,
                "window": "1 minute",
                "retry_after": int(retry_after) + 1,
            }

        self._second_requests[client_id].append(current_time)
        self._minute_requests[client_id].append(current_time)

        return True, {
            "limit": self.requests_per_second,
            "remaining": self.requests_per_second - second_count - 1,
            "reset": int(current_time) + 1,
        }


rate_limiter = RateLimiter(requests_per_second=30, requests_per_minute=1000)


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
