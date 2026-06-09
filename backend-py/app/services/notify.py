"""In-app (Socket.IO) and Telegram activity notifications."""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from ..config import settings
from ..realtime import sio

logger = logging.getLogger(__name__)

MAX_TEXT = 600
ACTIVITY_MIN_GAP_MS = max(0, int(os.getenv("TELEGRAM_ACTIVITY_NOTIFY_MIN_GAP_SEC", "600") or 0)) * 1000

TELEGRAM_NOTIFY_FIELDS = {
    "username": 1,
    "preferredLanguage": 1,
    "telegramDailyNotify": 1,
    "telegramActivityNotify": 1,
    "telegramChatId": 1,
    "telegramUserId": 1,
    "telegramTimezoneOffsetMinutes": 1,
    "telegramQuietHoursEnabled": 1,
    "telegramQuietStartHour": 1,
    "telegramQuietEndHour": 1,
    "lastTelegramActivityNotifyAt": 1,
    "banned": 1,
}


def user_room(user_id: Any) -> str:
    return f"user:{user_id}"


def lang_of(user: dict[str, Any] | None) -> str:
    return "en" if (user or {}).get("preferredLanguage") == "en" else "ru"


def msg(user: dict[str, Any] | None, ru: str, en: str) -> str:
    return en if lang_of(user) == "en" else ru


async def notify_in_app_user(
    user_id: Any,
    message: str,
    *,
    type: str = "activity",
    extra: dict[str, Any] | None = None,
) -> None:
    if not user_id or not message:
        return
    payload: dict[str, Any] = {
        "type": type,
        "message": str(message)[:600],
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    await sio.emit("app_notification", payload, room=user_room(user_id))


async def notify_in_app_users(
    users: list[dict[str, Any]],
    message_for_user: Any,
    *,
    type: str = "activity",
) -> None:
    for user in users:
        text = message_for_user(user) if callable(message_for_user) else message_for_user
        await notify_in_app_user(user.get("_id"), text, type=type)


def _web_app_markup() -> dict[str, Any] | None:
    url = settings.telegram_web_app_url.strip()
    if not url.startswith("https://"):
        return None
    label = settings.telegram_bot_short_name or "Moodie"
    return {"inline_keyboard": [[{"text": f"Open {label}", "web_app": {"url": url}}]]}


async def _send_telegram_message(chat_id: Any, text: str) -> None:
    token = settings.telegram_bot_token.strip()
    if not token or not chat_id or not text:
        return
    payload: dict[str, Any] = {"chat_id": chat_id, "text": str(text)[:MAX_TEXT]}
    markup = _web_app_markup()
    if markup:
        payload["reply_markup"] = markup
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
        if res.status_code >= 400:
            raise RuntimeError(f"Telegram sendMessage {res.status_code}: {res.text[:200]}")


def _in_quiet_hours(user: dict[str, Any]) -> bool:
    from .telegram_bot import _in_quiet_hours as check

    return check(user)


def _wants_telegram_activity(user: dict[str, Any]) -> bool:
    if user.get("telegramActivityNotify") is False:
        return False
    if not (user.get("telegramActivityNotify") or user.get("telegramDailyNotify")):
        return False
    if not (user.get("telegramChatId") or user.get("telegramUserId")):
        return False
    return not _in_quiet_hours(user)


def _chat_id_for(user: dict[str, Any]) -> Any:
    return user.get("telegramChatId") or user.get("telegramUserId")


async def _claim_activity_slot(db: AsyncIOMotorDatabase, user: dict[str, Any], notify_type: str) -> bool:
    user_id = user.get("_id")
    if not user_id:
        return False
    cutoff = datetime.now(timezone.utc).timestamp() * 1000 - ACTIVITY_MIN_GAP_MS
    cutoff_dt = datetime.fromtimestamp(cutoff / 1000, tz=timezone.utc)
    result = await db.users.update_one(
        {
            "_id": user_id,
            "$or": [
                {"lastTelegramActivityNotifyAt": {"$exists": False}},
                {"lastTelegramActivityNotifyAt": None},
                {"lastTelegramActivityNotifyAt": {"$lte": cutoff_dt}},
            ],
        },
        {
            "$set": {
                "lastTelegramActivityNotifyAt": datetime.now(timezone.utc),
                "lastTelegramActivityNotifyType": notify_type or "activity",
            }
        },
    )
    return result.modified_count > 0


async def _notify_telegram_user_impl(
    db: AsyncIOMotorDatabase,
    user: dict[str, Any],
    text: str,
    notify_type: str,
) -> None:
    if not _wants_telegram_activity(user):
        return
    if not await _claim_activity_slot(db, user, notify_type):
        return
    await _send_telegram_message(_chat_id_for(user), text)


def notify_telegram_user(db: AsyncIOMotorDatabase, user: dict[str, Any], text: str, notify_type: str = "activity") -> None:
    if not _wants_telegram_activity(user):
        return

    async def _run() -> None:
        try:
            await _notify_telegram_user_impl(db, user, text, notify_type)
        except Exception as exc:
            logger.warning("Telegram activity notify failed: %s", exc)

    asyncio.create_task(_run())


def notify_telegram_users(
    db: AsyncIOMotorDatabase,
    users: list[dict[str, Any]],
    text_for_user: Any,
    notify_type: str = "activity",
) -> None:
    for user in users:
        text = text_for_user(user) if callable(text_for_user) else text_for_user
        notify_telegram_user(db, user, text, notify_type)


async def notify_follow(db: AsyncIOMotorDatabase, actor: dict[str, Any], target: dict[str, Any]) -> None:
    text = msg(
        target,
        f"👋 {actor.get('username')} подписался на вас в Moodie.",
        f"👋 {actor.get('username')} followed you on Moodie.",
    )
    notify_telegram_user(db, target, text, "follow")
    await notify_in_app_user(
        target["_id"],
        text,
        type="follow",
        extra={"href": f"/profile/{actor.get('username')}"},
    )


async def notify_post_reaction(
    db: AsyncIOMotorDatabase,
    actor: dict[str, Any],
    author: dict[str, Any],
    post_id: Any,
) -> None:
    text = msg(
        author,
        f"💜 {actor.get('username')} поддержал ваш пост в Moodie.",
        f"💜 {actor.get('username')} supported your post on Moodie.",
    )
    notify_telegram_user(db, author, text, "reaction")
    await notify_in_app_user(
        author["_id"],
        text,
        type="reaction",
        extra={"href": f"/profile/{author.get('username')}?post={post_id}"},
    )


async def notify_post_relatable(
    db: AsyncIOMotorDatabase,
    actor: dict[str, Any],
    author: dict[str, Any],
    post_id: Any,
    relatable_count: int,
) -> None:
    milestone = relatable_count if relatable_count in {3, 5, 10} else None
    notify_type = "relatable_milestone" if milestone else "relatable"
    if milestone:
        text = msg(
            author,
            f"✨ Ваш пост уже почувствовали {milestone} раз. Вы не одни.",
            f"✨ Your post has been felt {milestone} times. You are not alone.",
        )
    else:
        text = msg(
            author,
            f"🤝 {actor.get('username')} тоже почувствовал ваш пост в Moodie.",
            f"🤝 {actor.get('username')} felt your post too on Moodie.",
        )
    notify_telegram_user(db, author, text, notify_type)
    await notify_in_app_user(
        author["_id"],
        text,
        type=notify_type,
        extra={"href": f"/profile/{author.get('username')}?post={post_id}"},
    )


async def notify_post_comment(
    db: AsyncIOMotorDatabase,
    actor: dict[str, Any],
    owner: dict[str, Any],
    post_id: Any,
) -> None:
    text = msg(
        owner,
        f"💬 {actor.get('username')} прокомментировал ваш пост в Moodie.",
        f"💬 {actor.get('username')} commented on your post on Moodie.",
    )
    notify_telegram_user(db, owner, text, "comment")
    await notify_in_app_user(
        owner["_id"],
        text,
        type="comment",
        extra={"href": f"/profile/{owner.get('username')}?post={post_id}"},
    )


async def notify_same_mood_followers(db: AsyncIOMotorDatabase, author: dict[str, Any], emotion: str) -> None:
    author_id = author.get("_id")
    if not author_id:
        return
    followers = await db.users.find(
        {
            "following": author_id,
            "_id": {"$ne": author_id},
            "currentEmotion": emotion,
            "telegramActivityNotify": {"$ne": False},
            "banned": {"$ne": True},
        },
        TELEGRAM_NOTIFY_FIELDS,
    ).to_list(200)
    if not followers:
        return

    def text_for(user: dict[str, Any]) -> str:
        return msg(
            user,
            f"💭 {author.get('username')} сейчас чувствует то же, что и вы. Откройте Moodie, чтобы поддержать.",
            f"💭 {author.get('username')} feels the same as you right now. Open Moodie to support them.",
        )

    notify_telegram_users(db, followers, text_for, "same_mood")
    await notify_in_app_users(followers, text_for, type="same_mood")


async def load_notify_user(db: AsyncIOMotorDatabase, user_id: Any) -> dict[str, Any] | None:
    if not isinstance(user_id, ObjectId):
        try:
            user_id = ObjectId(str(user_id))
        except Exception:
            return None
    return await db.users.find_one({"_id": user_id, "banned": {"$ne": True}}, TELEGRAM_NOTIFY_FIELDS)
