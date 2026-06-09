"""Evening day review — Telegram bot and web check-in (one per local day)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

VALID_CHOICES = frozenset({"hard", "ok", "good"})


def _timezone_offset_minutes(user: dict[str, Any]) -> int:
    try:
        offset = int(user.get("telegramTimezoneOffsetMinutes", 0))
    except (TypeError, ValueError):
        offset = 0
    return max(-840, min(840, offset))


def user_day_key(user: dict[str, Any], value: datetime | None = None) -> str:
    now = value or datetime.now(timezone.utc)
    local = now - timedelta(minutes=_timezone_offset_minutes(user))
    return local.date().isoformat()


async def get_today_review(db: AsyncIOMotorDatabase, user_id: Any, day_key: str) -> dict[str, Any] | None:
    row = await db.eveningreviews.find_one({"userId": user_id, "dayKey": day_key})
    return row if isinstance(row, dict) else None


def evening_choice_label(choice: str, lang: str) -> str:
    labels = {
        "ru": {"hard": "Тяжёлый", "ok": "Нормальный", "good": "Хороший"},
        "en": {"hard": "Rough", "ok": "Okay", "good": "Good"},
    }
    return labels["en" if lang == "en" else "ru"].get(choice, choice)


async def save_evening_review(
    db: AsyncIOMotorDatabase,
    user_id: Any,
    day_key: str,
    choice: str,
) -> bool:
    if choice not in VALID_CHOICES:
        return False
    now = datetime.now(timezone.utc)
    try:
        await db.eveningreviews.update_one(
            {"userId": user_id, "dayKey": day_key},
            {"$set": {"choice": choice, "updatedAt": now}, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )
        return True
    except Exception:
        return False
