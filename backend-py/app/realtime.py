from typing import Any

import socketio

from .config import settings

_cors: str | list[str] = list(settings.cors_origins) if settings.cors_origins else "*"

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=_cors, transports=["websocket", "polling"])

_online_count = 0


@sio.event
async def connect(_sid: str, _environ: dict[str, Any]) -> None:
    global _online_count
    _online_count += 1
    await sio.emit("online_count", _online_count)


@sio.event
async def disconnect(_sid: str) -> None:
    global _online_count
    _online_count = max(0, _online_count - 1)
    await sio.emit("online_count", _online_count)


async def emit_new_post(post: dict[str, Any]) -> None:
    await sio.emit("new_post", post)


async def emit_daily_answer(payload: dict[str, Any]) -> None:
    await sio.emit("daily_answer", payload)

