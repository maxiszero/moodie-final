from typing import Any

import jwt
import socketio
from bson import ObjectId

from .config import settings
from .db import get_database
from .security import require_jwt_secret

_cors: str | list[str] = list(settings.cors_origins) if settings.cors_origins else "*"

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=_cors, transports=["websocket", "polling"])

_connected_sids: set[str] = set()


async def _emit_online_count() -> None:
    await sio.emit("online_count", len(_connected_sids))


@sio.event
async def connect(sid: str, _environ: dict[str, Any]) -> None:
    _connected_sids.add(sid)
    await _emit_online_count()


@sio.event
async def disconnect(sid: str) -> None:
    _connected_sids.discard(sid)
    await _emit_online_count()


def _user_room(user_id: Any) -> str:
    return f"user:{user_id}"


@sio.event
async def auth_user(sid: str, token: str) -> None:
    if not token or not isinstance(token, str):
        return
    try:
        decoded = jwt.decode(token, require_jwt_secret(), algorithms=["HS256"])
        user_id = decoded.get("id")
        if not isinstance(user_id, str):
            return
        oid = ObjectId(user_id)
    except Exception:
        return
    db = get_database()
    exists = await db.users.find_one({"_id": oid, "banned": {"$ne": True}}, {"_id": 1})
    if not exists:
        return
    await sio.enter_room(sid, _user_room(oid))


async def emit_new_post(post: dict[str, Any]) -> None:
    await sio.emit("new_post", post)


async def emit_daily_answer(payload: dict[str, Any]) -> None:
    await sio.emit("daily_answer", payload)

