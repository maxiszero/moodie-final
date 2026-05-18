from typing import Any

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..dependencies import current_user, db_dependency
from ..services.mood_neighbors import fetch_mood_neighbors, upsert_presence

router = APIRouter(prefix="/mood-neighbors", tags=["mood-neighbors"])


@router.post("/join")
async def join_mood_neighbors(
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    emotion, bucket = await upsert_presence(db, user)
    from datetime import datetime, timedelta, timezone

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=15 * 60)
    return {"ok": True, "expiresAt": expires_at.isoformat(), "emotion": emotion, "bucket": bucket}


@router.get("")
async def get_mood_neighbors(
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    return await fetch_mood_neighbors(db, user)
