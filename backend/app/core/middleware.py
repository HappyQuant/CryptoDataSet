import time
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import uuid

logger = logging.getLogger("api")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id

        start_time = time.time()

        logger.info(
            f"[{request_id}] {request.method} {request.url.path} - Started",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client": request.client.host if request.client else None,
            }
        )

        try:
            response = await call_next(request)
            process_time = time.time() - start_time

            logger.info(
                f"[{request_id}] {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "process_time": process_time,
                }
            )

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"[{request_id}] {request.method} {request.url.path} - Error: {str(e)} ({process_time:.3f}s)",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "process_time": process_time,
                },
                exc_info=True,
            )
            raise


class RequestMetrics:
    def __init__(self):
        self.total_requests = 0
        self.total_errors = 0
        self.total_request_time = 0.0
        self.endpoint_counts = {}

    def record_request(self, path: str, status_code: int, request_time: float):
        self.total_requests += 1
        self.total_request_time += request_time
        if status_code >= 400:
            self.total_errors += 1
        self.endpoint_counts[path] = self.endpoint_counts.get(path, 0) + 1

    def get_stats(self) -> dict:
        avg_time = self.total_request_time / self.total_requests if self.total_requests > 0 else 0
        error_rate = self.total_errors / self.total_requests if self.total_requests > 0 else 0
        return {
            "total_requests": self.total_requests,
            "total_errors": self.total_errors,
            "average_request_time": round(avg_time, 3),
            "error_rate": round(error_rate, 3),
            "endpoint_counts": self.endpoint_counts,
        }

    def reset(self):
        self.total_requests = 0
        self.total_errors = 0
        self.total_request_time = 0.0
        self.endpoint_counts = {}


request_metrics = RequestMetrics()
