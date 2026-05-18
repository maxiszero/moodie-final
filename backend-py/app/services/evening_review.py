"""Evening day review — one check-in per day via Telegram."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

VALID_CHOICES = frozenset({"hard", "ok", "good"})


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
