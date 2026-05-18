from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from .daily_question import get_mood_bucket
from .palette import normalize_emotion

PRESENCE_SEC = 15 * 60
POST_LOOKBACK = timedelta(hours=48)
MAX_SNIPPETS = 12

_EMOTION_LABELS: dict[str, dict[str, str]] = {
    "happy": {"ru": "радость", "en": "happy"},
    "sad": {"ru": "грусть", "en": "sad"},
    "angry": {"ru": "злость", "en": "angry"},
    "neutral": {"ru": "нейтральное", "en": "neutral"},
    "excited": {"ru": "воодушевление", "en": "excited"},
    "tired": {"ru": "усталость", "en": "tired"},
    "scared": {"ru": "страх", "en": "scared"},
    "loved": {"ru": "любовь", "en": "loved"},
    "inspiration": {"ru": "вдохновение", "en": "inspiration"},
    "anxiety": {"ru": "тревога", "en": "anxiety"},
    "anxious": {"ru": "тревога", "en": "anxious"},
    "drive": {"ru": "драйв", "en": "drive"},
    "melancholy": {"ru": "меланхолия", "en": "melancholy"},
    "calmness": {"ru": "спокойствие", "en": "calmness"},
    "apathy": {"ru": "апатия", "en": "apathy"},
}


def emotion_label(emotion: str | None, lang: str) -> str:
    key = (emotion or "neutral").strip().lower()
    bucket = _EMOTION_LABELS.get(key)
    if bucket:
        return bucket["en"] if lang == "en" else bucket["ru"]
    return key or "neutral"


async def _excluded_user_ids(db: AsyncIOMotorDatabase, user_id: Any) -> set[str]:
    excluded = {str(user_id)}
    me = await db.users.find_one({"_id": user_id}, {"blockedUsers": 1})
    for bid in me.get("blockedUsers") or [] if me else []:
        excluded.add(str(bid))
    async for blocker in db.users.find({"blockedUsers": user_id}, {"_id": 1}):
        excluded.add(str(blocker["_id"]))
    return excluded


async def upsert_presence(db: AsyncIOMotorDatabase, user: dict[str, Any]) -> tuple[str, str]:
    emotion = normalize_emotion(user.get("currentEmotion")) or "neutral"
    bucket = get_mood_bucket(emotion)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=PRESENCE_SEC)
    await db.moodneighborpresence.update_one(
        {"userId": user["_id"]},
        {
            "$set": {
                "emotion": emotion,
                "bucket": bucket,
                "expiresAt": expires_at,
                "updatedAt": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    return emotion, bucket


async def fetch_mood_neighbors(db: AsyncIOMotorDatabase, user: dict[str, Any]) -> dict[str, Any]:
    lang = "en" if user.get("preferredLanguage") == "en" else "ru"
    emotion, bucket = await upsert_presence(db, user)
    now = datetime.now(timezone.utc)
    excluded = await _excluded_user_ids(db, user["_id"])

    base = {"expiresAt": {"$gt": now}}
    match_mode = "emotion"
    peers = await db.moodneighborpresence.find({**base, "emotion": emotion}, {"userId": 1}).to_list(500)
    peer_ids = [p["userId"] for p in peers if str(p.get("userId")) not in excluded]

    if len(peer_ids) < 2:
        match_mode = "bucket"
        peers = await db.moodneighborpresence.find({**base, "bucket": bucket}, {"userId": 1}).to_list(500)
        peer_ids = [p["userId"] for p in peers if str(p.get("userId")) not in excluded]

    count = len(peer_ids)
    snippets: list[dict[str, Any]] = []
    if peer_ids:
        since = now - POST_LOOKBACK
        posts = (
            await db.posts.find(
                {
                    "userId": {"$in": peer_ids},
                    "hidden": {"$ne": True},
                    "createdAt": {"$gte": since},
                    "text": {"$exists": True, "$nin": ["", None]},
                },
                {"text": 1, "emoji": 1, "emotion": 1, "createdAt": 1},
            )
            .sort("createdAt", -1)
            .limit(MAX_SNIPPETS)
            .to_list(MAX_SNIPPETS)
        )
        for post in posts:
            created = post.get("createdAt")
            ago = 0
            if isinstance(created, datetime):
                ago = max(0, int((now - created).total_seconds() // 60))
            text = " ".join(str(post.get("text") or "").split())[:160]
            snippets.append(
                {
                    "emoji": post.get("emoji") or "😐",
                    "emotion": post.get("emotion") or "neutral",
                    "text": text,
                    "agoMinutes": ago,
                }
            )

    return {
        "count": count,
        "matchMode": match_mode,
        "emotion": emotion,
        "emotionLabel": emotion_label(emotion, lang),
        "bucket": bucket,
        "expiresInSec": PRESENCE_SEC,
        "snippets": snippets,
    }
