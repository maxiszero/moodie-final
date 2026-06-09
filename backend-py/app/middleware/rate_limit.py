"""Simple in-memory per-IP rate limiting (single-instance friendly)."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from ..security import client_ip

_buckets: dict[str, list[float]] = defaultdict(list)


def _hit(key: str, window_sec: float, max_hits: int) -> bool:
    now = time.time()
    hits = _buckets[key]
    hits[:] = [t for t in hits if now - t < window_sec]
    if len(hits) >= max_hits:
        return False
    hits.append(now)
    return True


def _rule_for_path(path: str) -> tuple[float, int, str] | None:
    if path.startswith("/api/auth"):
        return 15 * 60, 40, "Too many auth attempts. Try again later."
    if path.endswith("/ai/tip") or "/mood-song/" in path:
        return 60, 12, "Too many AI tip requests. Slow down."
    if path.rstrip("/") == "/api/posts" and path.count("/") <= 3:
        return 60, 20, "Too many posts. Slow down."
    if "/comments" in path and path.startswith("/api/posts/"):
        return 60, 30, "Too many comments. Slow down."
    if path.startswith("/api/posts/") and any(
        path.endswith(suffix) for suffix in ("/reaction", "/relatable", "/like", "/report")
    ):
        return 60, 120, "Too many actions. Slow down."
    return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        rule = _rule_for_path(request.url.path)
        if rule:
            window_sec, max_hits, message = rule
            key = f"{client_ip(request)}:{request.url.path}"
            if not _hit(key, window_sec, max_hits):
                return JSONResponse(status_code=429, content={"message": message})
        return await call_next(request)
