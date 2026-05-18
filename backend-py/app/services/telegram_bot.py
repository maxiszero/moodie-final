"""Telegram bot: getUpdates loop and daily question reminders for opted-in users."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from ..config import settings
from ..routers.posts import create_post_from_text
from ..db import get_database
from .daily_question import get_mood_bucket, pick_question, utc_day_key

logger = logging.getLogger(__name__)


def _user_lang(user: dict[str, Any] | None, from_user: dict[str, Any]) -> str:
    if user and user.get("preferredLanguage") in {"ru", "en"}:
        return user["preferredLanguage"]
    lc = (from_user.get("language_code") or "").lower()
    return "en" if lc.startswith("en") else "ru"


def _web_app_markup() -> dict[str, Any] | None:
    url = settings.telegram_web_app_url.strip()
    if not url.startswith("https://"):
        return None
    return {
        "inline_keyboard": [
            [
                {
                    "text": f"Open {settings.telegram_bot_short_name}",
                    "web_app": {"url": url},
                }
            ]
        ]
    }


def _settings_markup(user: dict[str, Any] | None) -> dict[str, Any] | None:
    base = _web_app_markup()
    rows = base["inline_keyboard"] if base else []
    if user:
        daily_on = bool(user.get("telegramDailyNotify"))
        activity_on = user.get("telegramActivityNotify") is not False
        rows = [
            *rows,
            [
                {
                    "text": f"Daily {'off' if daily_on else 'on'}",
                    "callback_data": f"notify:daily:{'off' if daily_on else 'on'}",
                },
                {
                    "text": f"Activity {'off' if activity_on else 'on'}",
                    "callback_data": f"notify:activity:{'off' if activity_on else 'on'}",
                },
            ],
        ]
    return {"inline_keyboard": rows} if rows else None


def _mood_song_markup(user: dict[str, Any] | None, lang: str) -> dict[str, Any] | None:
    rows: list[list[dict[str, Any]]] = []
    preview_url = (user or {}).get("moodSongPreviewUrl")
    external_url = (user or {}).get("moodSongExternalUrl")
    if isinstance(preview_url, str) and preview_url.startswith("https://"):
        rows.append([{"text": "▶ Listen preview" if lang == "en" else "▶ Слушать preview", "url": preview_url}])
    if isinstance(external_url, str) and external_url.startswith("https://"):
        rows.append([{"text": "Apple Music", "url": external_url}])
    base = _web_app_markup()
    if base:
        rows.extend(base["inline_keyboard"])
    return {"inline_keyboard": rows} if rows else None


def _mood_song_text(user: dict[str, Any] | None, lang: str) -> str | None:
    if not user:
        return None
    title = (user.get("moodSongTitle") or "").strip()
    artist = (user.get("moodSongArtist") or "").strip()
    if not title or not artist:
        return None
    if lang == "en":
        return f"🎧 Mood song\n\n{artist} — {title}\n\nTap Listen to play the free iTunes preview."
    return f"🎧 Песня настроения\n\n{artist} — {title}\n\nНажмите «Слушать», чтобы включить бесплатный preview из iTunes."


def _parse_command(text: str) -> tuple[str, str]:
    t = text.strip()
    if not t.startswith("/"):
        return "", ""
    parts = t.split(maxsplit=1)
    cmd = parts[0][1:].split("@", 1)[0].lower()
    arg = parts[1].strip().lower() if len(parts) > 1 else ""
    return cmd, arg


def _chat_id_for_delivery(user: dict[str, Any], fallback_chat_id: int) -> int:
    raw = user.get("telegramChatId")
    if isinstance(raw, int):
        return raw
    if isinstance(raw, float):
        return int(raw)
    tid = user.get("telegramUserId")
    if tid is not None:
        return int(tid)
    return int(fallback_chat_id)


def _clamped_hour(value: Any, fallback: int) -> int:
    try:
        hour = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(0, min(23, hour))


def _timezone_offset_minutes(user: dict[str, Any]) -> int:
    try:
        offset = int(user.get("telegramTimezoneOffsetMinutes", 0))
    except (TypeError, ValueError):
        offset = 0
    return max(-840, min(840, offset))


def _local_now(user: dict[str, Any], value: datetime | None = None) -> datetime:
    now = value or datetime.now(timezone.utc)
    return now - timedelta(minutes=_timezone_offset_minutes(user))


def _local_day_key(user: dict[str, Any], value: datetime | None = None) -> str:
    return _local_now(user, value).date().isoformat()


def _in_quiet_hours(user: dict[str, Any], value: datetime | None = None) -> bool:
    if not user.get("telegramQuietHoursEnabled"):
        return False
    start = _clamped_hour(user.get("telegramQuietStartHour"), 23)
    end = _clamped_hour(user.get("telegramQuietEndHour"), 9)
    if start == end:
        return False
    hour = _local_now(user, value).hour
    return start <= hour < end if start < end else hour >= start or hour < end


def _daily_due_now(user: dict[str, Any], value: datetime | None = None) -> bool:
    now = value or datetime.now(timezone.utc)
    if _in_quiet_hours(user, now):
        return False
    hour = _clamped_hour(user.get("telegramDailyNotifyHour"), settings.telegram_daily_notify_utc_hour)
    return _local_now(user, now).hour == hour


def _notify_status_text(user: dict[str, Any], lang: str) -> str:
    daily = bool(user.get("telegramDailyNotify"))
    activity = user.get("telegramActivityNotify") is not False and bool(user.get("telegramChatId") or user.get("telegramUserId"))
    hour = _clamped_hour(user.get("telegramDailyNotifyHour"), settings.telegram_daily_notify_utc_hour)
    quiet = bool(user.get("telegramQuietHoursEnabled"))
    q_start = _clamped_hour(user.get("telegramQuietStartHour"), 23)
    q_end = _clamped_hour(user.get("telegramQuietEndHour"), 9)
    if lang == "en":
        return (
            "🔔 Notification settings\n\n"
            f"🌤 Daily question: {'on' if daily else 'off'}\n"
            f"⏰ Daily time: {hour:02d}:00 local\n"
            f"💬 Activity: {'on' if activity else 'off'}\n"
            f"🌙 Quiet hours: {f'{q_start:02d}:00–{q_end:02d}:00' if quiet else 'off'}\n\n"
            "Use /notify daily on|off or /notify activity on|off."
        )
    return (
        "🔔 Настройки уведомлений\n\n"
        f"🌤 Вопрос дня: {'вкл' if daily else 'выкл'}\n"
        f"⏰ Время вопроса: {hour:02d}:00 локально\n"
        f"💬 Активность: {'вкл' if activity else 'выкл'}\n"
        f"🌙 Тихие часы: {f'{q_start:02d}:00–{q_end:02d}:00' if quiet else 'выкл'}\n\n"
        "Команды: /notify daily on|off или /notify activity on|off."
    )


def _notify_quick_text(user: dict[str, Any], lang: str) -> str:
    daily = bool(user.get("telegramDailyNotify"))
    activity = user.get("telegramActivityNotify") is not False and bool(user.get("telegramChatId") or user.get("telegramUserId"))
    if lang == "en":
        return (
            "⚡ Quick notifications\n\n"
            f"🌤 Daily: {'on' if daily else 'off'}\n"
            f"💬 Activity: {'on' if activity else 'off'}\n\n"
            "Tap a button below, or use /settings for full schedule and quiet hours."
        )
    return (
        "⚡ Быстрые уведомления\n\n"
        f"🌤 Вопрос дня: {'вкл' if daily else 'выкл'}\n"
        f"💬 Активность: {'вкл' if activity else 'выкл'}\n\n"
        "Нажмите кнопку ниже или используйте /settings для времени и тихих часов."
    )


class TelegramBotRunner:
    def __init__(self) -> None:
        self._token = settings.telegram_bot_token.strip()
        self._api = f"https://api.telegram.org/bot{self._token}"

    async def _post_json(self, client: httpx.AsyncClient, method: str, body: dict[str, Any]) -> dict[str, Any]:
        r = await client.post(f"{self._api}/{method}", json=body)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code != 200 or data.get("ok") is not True:
            desc = data.get("description") if isinstance(data, dict) else None
            raise RuntimeError(f"{method} HTTP {r.status_code}: {desc or r.text[:200]}")
        return data

    async def send_message(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        await self._post_json(client, "sendMessage", payload)

    async def answer_callback_query(self, client: httpx.AsyncClient, callback_id: str, text: str = "") -> None:
        payload: dict[str, Any] = {"callback_query_id": callback_id}
        if text:
            payload["text"] = text
        await self._post_json(client, "answerCallbackQuery", payload)

    async def edit_message_text(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        message_id: int,
        text: str,
        *,
        reply_markup: dict[str, Any] | None = None,
    ) -> None:
        payload: dict[str, Any] = {"chat_id": chat_id, "message_id": message_id, "text": text}
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        await self._post_json(client, "editMessageText", payload)

    async def handle_callback_query(self, client: httpx.AsyncClient, callback: dict[str, Any]) -> None:
        callback_id = callback.get("id")
        from_user = callback.get("from") or {}
        tg_uid = from_user.get("id")
        data = callback.get("data")
        if not callback_id or tg_uid is None or not isinstance(data, str):
            return

        db = get_database()
        user = await db.users.find_one({"telegramUserId": int(tg_uid)})
        lang = _user_lang(user, from_user)
        if not user:
            await self.answer_callback_query(
                client,
                str(callback_id),
                "Link Telegram first" if lang == "en" else "Сначала привяжите Telegram",
            )
            return

        parts = data.split(":")
        if len(parts) == 3 and parts[0] == "notify" and parts[1] in {"daily", "activity"}:
            field = "telegramDailyNotify" if parts[1] == "daily" else "telegramActivityNotify"
            value = parts[2] == "on"
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {field: value, "updatedAt": datetime.now(timezone.utc)}},
            )
            await self.answer_callback_query(
                client,
                str(callback_id),
                "Updated" if lang == "en" else "Обновлено",
            )
            chat = (callback.get("message") or {}).get("chat") or {}
            message_id = (callback.get("message") or {}).get("message_id")
            chat_id = chat.get("id")
            if chat_id is not None and message_id is not None:
                fresh = {**user, field: value}
                await self.edit_message_text(
                    client,
                    int(chat_id),
                    int(message_id),
                    _notify_status_text(fresh, lang),
                    reply_markup=_settings_markup(fresh),
                )

    async def handle_private_message(self, client: httpx.AsyncClient, message: dict[str, Any]) -> None:
        chat = message.get("chat") or {}
        if chat.get("type") != "private":
            return
        from_user = message.get("from") or {}
        chat_id = chat.get("id")
        tg_uid = from_user.get("id")
        if chat_id is None or tg_uid is None:
            return

        db = get_database()
        user = await db.users.find_one({"telegramUserId": int(tg_uid)})
        lang = _user_lang(user, from_user)
        markup = _web_app_markup()

        async def reply(msg: str, *, with_app: bool = True) -> None:
            await self.send_message(
                client,
                int(chat_id),
                msg,
                reply_markup=markup if with_app and markup else None,
            )

        text_raw = message.get("text")
        if not isinstance(text_raw, str):
            if user and user.get("telegramAwaitingPost"):
                if lang == "en":
                    await reply("Please send text for your post (not a photo or sticker).")
                else:
                    await reply("Пришлите текст поста (не фото и не стикер).")
            return

        cmd, arg = _parse_command(text_raw)

        if not cmd and user and user.get("telegramAwaitingPost"):
            if user.get("banned"):
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"telegramAwaitingPost": False, "updatedAt": datetime.now(timezone.utc)}},
                )
                await reply("⛔ This account is restricted." if lang == "en" else "⛔ Этот аккаунт ограничен.", with_app=True)
            else:
                try:
                    created = await create_post_from_text(db, user, text_raw)
                except HTTPException as exc:
                    err_detail = exc.detail
                    err_msg = err_detail.get("message") if isinstance(err_detail, dict) else str(err_detail)
                    await reply(str(err_msg), with_app=True)
                    return
                except Exception:
                    logger.exception("telegram create_post_from_text failed")
                    await reply(
                        "Could not publish. Try again." if lang == "en" else "Не удалось опубликовать. Попробуйте ещё раз.",
                        with_app=True,
                    )
                    return
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"telegramAwaitingPost": False, "updatedAt": datetime.now(timezone.utc)}},
                )
                emotion = created.get("emotion") or "neutral"
                if lang == "en":
                    await reply(f"Published\nYour mood: {emotion}", with_app=True)
                else:
                    await reply(f"Опубликовано\nВаша эмоция: {emotion}", with_app=True)
            return

        if not cmd:
            return

        if cmd == "start":
            if lang == "en":
                await reply(
                    "👋 Hi! I’m the Moodie bot — open the mini app to post, read the feed, "
                    "and answer the daily question.\n\n"
                    "✨ Use /help for commands. Turn on a daily reminder with /notify on "
                    "(requires a linked Moodie account).",
                )
            else:
                await reply(
                    "👋 Привет! Я бот Moodie — откройте мини-приложение, чтобы постить, "
                    "читать ленту и отвечать на вопрос дня.\n\n"
                    "✨ Команды: /help. Ежедневное напоминание: /notify on "
                    "(нужен привязанный аккаунт Moodie).",
                )
            return

        if cmd == "help":
            if lang == "en":
                await reply(
                    "🧭 Commands\n\n"
                    "/start — intro\n"
                    "/app — open Moodie\n"
                    "/post — next message becomes your post\n"
                    "/cancel — cancel /post draft\n"
                    "/today — today’s reflection question + Open button\n"
                    "/song — your current mood song\n"
                    "/notify on|off — all notifications\n"
                    "/notify daily on|off — daily question\n"
                    "/notify activity on|off — follows, comments, support\n"
                    "/settings — notification status\n"
                    "/me — linked account info",
                )
            else:
                await reply(
                    "🧭 Команды\n\n"
                    "/start — знакомство\n"
                    "/app — открыть Moodie\n"
                    "/post — следующее сообщение станет постом\n"
                    "/cancel — отменить черновик после /post\n"
                    "/today — вопрос дня + кнопка «Открыть»\n"
                    "/song — текущая песня настроения\n"
                    "/notify on|off — все уведомления\n"
                    "/notify daily on|off — вопрос дня\n"
                    "/notify activity on|off — подписки, комментарии, поддержка\n"
                    "/settings — статус уведомлений\n"
                    "/me — информация о привязке",
                )
            return

        if cmd == "app":
            if lang == "en":
                await reply("🚀 Open Moodie:", with_app=True)
            else:
                await reply("🚀 Откройте Moodie:", with_app=True)
            return

        if cmd == "post":
            if not user:
                await reply(
                    "🔗 Link Telegram to your Moodie account first: open the mini app → Settings → Telegram."
                    if lang == "en"
                    else "🔗 Сначала привяжите Telegram в приложении: мини-приложение → Настройки → Telegram.",
                    with_app=True,
                )
                return
            if user.get("banned"):
                if lang == "en":
                    await reply("⛔ This account is restricted.")
                else:
                    await reply("⛔ Этот аккаунт ограничен.")
                return
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "telegramAwaitingPost": True,
                        "telegramChatId": int(chat_id),
                        "updatedAt": datetime.now(timezone.utc),
                    }
                },
            )
            if lang == "en":
                await reply(
                    "📝 Your next message will be published as a post in Moodie.\n\n"
                    "Send the text (max 228 characters, no links). /cancel — abort.",
                    with_app=True,
                )
            else:
                await reply(
                    "📝 Следующее сообщение будет опубликовано как пост в Moodie.\n\n"
                    "Пришлите текст (до 228 символов, без ссылок). /cancel — отменить.",
                    with_app=True,
                )
            return

        if cmd == "cancel":
            had_awaiting = bool(user and user.get("telegramAwaitingPost"))
            if user:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"telegramAwaitingPost": False, "updatedAt": datetime.now(timezone.utc)}},
                )
            if lang == "en":
                await reply(
                    "Cancelled." if had_awaiting else "No draft post to cancel.",
                    with_app=True,
                )
            else:
                await reply(
                    "Отменено." if had_awaiting else "Нет черновика поста.",
                    with_app=True,
                )
            return

        if cmd == "today":
            day_key = utc_day_key()
            bucket = get_mood_bucket((user or {}).get("currentEmotion"))
            question = pick_question(day_key, bucket, lang)
            if lang == "en":
                line = f"🌤 Today's question\n\n{question}"
            else:
                line = f"🌤 Вопрос дня\n\n{question}"
            await self.send_message(client, int(chat_id), line, reply_markup=_settings_markup(user))
            return

        if cmd == "song":
            line = _mood_song_text(user, lang)
            if not line:
                await reply(
                    "🎧 No mood song yet. Publish a post first, and Moodie will pick one."
                    if lang == "en"
                    else "🎧 Песни настроения пока нет. Опубликуйте пост, и Moodie подберёт трек.",
                    with_app=True,
                )
                return
            await self.send_message(client, int(chat_id), line, reply_markup=_mood_song_markup(user, lang))
            return

        if cmd == "me":
            if not user:
                await reply(
                    "🔗 Telegram is not linked to a Moodie account." if lang == "en" else "🔗 Telegram не привязан к аккаунту Moodie.",
                    with_app=True,
                )
                return
            username = user.get("username") or "Moodie"
            emotion = user.get("currentEmotion") or "neutral"
            if lang == "en":
                await reply(f"👤 Linked account: {username}\n💭 Current mood: {emotion}", with_app=True)
            else:
                await reply(f"👤 Привязанный аккаунт: {username}\n💭 Текущее состояние: {emotion}", with_app=True)
            return

        if cmd == "settings":
            if not user:
                await reply(
                    "🔗 Link Telegram to your Moodie account first: open the mini app → Settings → Telegram."
                    if lang == "en"
                    else "🔗 Сначала привяжите Telegram в приложении: мини-приложение → Настройки → Telegram.",
                    with_app=True,
                )
                return
            await self.send_message(client, int(chat_id), _notify_status_text(user, lang), reply_markup=_settings_markup(user))
            return

        if cmd == "notify":
            if not user:
                if lang == "en":
                    await reply(
                        "🔗 Link Telegram to your Moodie account first: open the mini app → Settings → Telegram.",
                        with_app=True,
                    )
                else:
                    await reply(
                        "🔗 Сначала привяжите Telegram в приложении: мини-приложение → Настройки → Telegram.",
                        with_app=True,
                    )
                return
            if user.get("banned"):
                if lang == "en":
                    await reply("⛔ This account is restricted.")
                else:
                    await reply("⛔ Этот аккаунт ограничен.")
                return

            parts = arg.split()
            scope = parts[0] if parts and parts[0] in {"daily", "activity"} else "all"
            action = parts[1] if scope != "all" and len(parts) > 1 else (parts[0] if parts else "")

            if action in ("on", "1", "true", "yes"):
                fields: dict[str, Any] = {"telegramChatId": int(chat_id), "updatedAt": datetime.now(timezone.utc)}
                if scope in {"all", "daily"}:
                    fields["telegramDailyNotify"] = True
                if scope in {"all", "activity"}:
                    fields["telegramActivityNotify"] = True
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": fields},
                )
                if lang == "en":
                    await self.send_message(
                        client,
                        int(chat_id),
                        "✅ Notifications updated.\n\n" + _notify_status_text({**user, **fields}, lang),
                        reply_markup=_settings_markup({**user, **fields}),
                    )
                else:
                    await self.send_message(
                        client,
                        int(chat_id),
                        "✅ Уведомления обновлены.\n\n" + _notify_status_text({**user, **fields}, lang),
                        reply_markup=_settings_markup({**user, **fields}),
                    )
                return

            if action in ("off", "0", "false", "no"):
                fields: dict[str, Any] = {"updatedAt": datetime.now(timezone.utc)}
                if scope in {"all", "daily"}:
                    fields["telegramDailyNotify"] = False
                if scope in {"all", "activity"}:
                    fields["telegramActivityNotify"] = False
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": fields},
                )
                if lang == "en":
                    await self.send_message(
                        client,
                        int(chat_id),
                        "✅ Notifications updated.\n\n" + _notify_status_text({**user, **fields}, lang),
                        reply_markup=_settings_markup({**user, **fields}),
                    )
                else:
                    await self.send_message(
                        client,
                        int(chat_id),
                        "✅ Уведомления обновлены.\n\n" + _notify_status_text({**user, **fields}, lang),
                        reply_markup=_settings_markup({**user, **fields}),
                    )
                return

            await self.send_message(client, int(chat_id), _notify_quick_text(user, lang), reply_markup=_settings_markup(user))
            return


async def run_daily_notifies(runner: TelegramBotRunner) -> None:
    db = get_database()
    question_day_key = utc_day_key()
    markup = _web_app_markup()
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        cursor = db.users.find(
            {
                "telegramDailyNotify": True,
                "telegramUserId": {"$exists": True, "$ne": None},
                "banned": {"$ne": True},
            }
        )
        async for user in cursor:
            if not _daily_due_now(user, now):
                continue
            notify_day_key = _local_day_key(user, now)
            claim = await db.users.update_one(
                {
                    "_id": user["_id"],
                    "telegramDailyNotify": True,
                    "banned": {"$ne": True},
                    "$or": [
                        {"lastDailyNotifyDayKey": {"$exists": False}},
                        {"lastDailyNotifyDayKey": {"$ne": notify_day_key}},
                    ],
                },
                {"$set": {"lastDailyNotifyDayKey": notify_day_key, "updatedAt": datetime.now(timezone.utc)}},
            )
            if claim.modified_count == 0:
                continue

            lang = "en" if user.get("preferredLanguage") == "en" else "ru"
            bucket = get_mood_bucket(user.get("currentEmotion"))
            question = pick_question(question_day_key, bucket, lang)
            chat_id = _chat_id_for_delivery(user, int(user["telegramUserId"]))
            recent_post = await db.posts.find_one(
                {"userId": user["_id"], "createdAt": {"$gte": datetime.now(timezone.utc) - timedelta(days=3)}},
                {"_id": 1},
            )
            if lang == "en":
                text = f"🌤 Today's reflection question\n\n{question}"
                if not recent_post:
                    text = f"💙 Moodie misses you. How are you today?\n\n{text}"
            else:
                text = f"🌤 Вопрос дня\n\n{question}"
                if not recent_post:
                    text = f"💙 Moodie скучает. Как вы сегодня?\n\n{text}"

            try:
                await runner.send_message(
                    client,
                    chat_id,
                    text,
                    reply_markup=markup,
                )
            except Exception:
                logger.exception("sendMessage failed for user %s", user.get("_id"))
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$unset": {"lastDailyNotifyDayKey": ""}},
                )
            await asyncio.sleep(0.06)


def _api_base() -> str:
    return f"https://api.telegram.org/bot{settings.telegram_bot_token.strip()}"


async def telegram_polling_loop() -> None:
    if not settings.telegram_bot_token.strip():
        return
    runner = TelegramBotRunner()
    base = _api_base()
    timeout = httpx.Timeout(45.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        offset = 0
        while True:
            try:
                r = await client.get(f"{base}/getUpdates", params={"timeout": 35, "offset": offset})
                payload = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                if r.status_code != 200 or payload.get("ok") is not True:
                    logger.warning("getUpdates failed HTTP %s: %s", r.status_code, payload)
                    await asyncio.sleep(3)
                    continue
                for upd in payload.get("result", []):
                    offset = int(upd["update_id"]) + 1
                    callback = upd.get("callback_query")
                    if isinstance(callback, dict):
                        try:
                            await runner.handle_callback_query(client, callback)
                        except Exception:
                            logger.exception("telegram callback handler failed")
                        continue
                    msg = upd.get("message") or upd.get("edited_message")
                    if not isinstance(msg, dict):
                        continue
                    try:
                        await runner.handle_private_message(client, msg)
                    except Exception:
                        logger.exception("telegram message handler failed")
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("polling loop error")
                await asyncio.sleep(3)


async def daily_notify_scheduler() -> None:
    if not settings.telegram_bot_token.strip():
        return
    runner = TelegramBotRunner()
    while True:
        try:
            await run_daily_notifies(runner)
        except Exception:
            logger.exception("run_daily_notifies failed")
        await asyncio.sleep(300)


def start_telegram_background_tasks() -> list[asyncio.Task]:
    if not settings.telegram_bot_token.strip():
        return []
    out: list[asyncio.Task] = [asyncio.create_task(daily_notify_scheduler())]
    if settings.telegram_enable_polling:
        out.append(asyncio.create_task(telegram_polling_loop()))
    else:
        logger.info(
            "TELEGRAM_ENABLE_POLLING=false: bot commands are disabled; daily reminders still use this process",
        )
    return out
