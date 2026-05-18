"""Telegram bot: getUpdates loop and daily question reminders for opted-in users."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from ..config import settings
from ..dependencies import banned_user_ids
from ..routers.posts import create_post_from_text, excluded_author_ids, projection_without_private
from ..db import get_database
from .daily_question import get_mood_bucket, pick_question, submit_daily_answer, utc_day_key
from .evening_review import evening_choice_label, save_evening_review

logger = logging.getLogger(__name__)

EMOTION_LABELS: dict[str, dict[str, str]] = {
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


def _emotion_label(emotion: str | None, lang: str) -> str:
    key = (emotion or "neutral").strip().lower()
    bucket = EMOTION_LABELS.get(key)
    if bucket:
        return bucket["en"] if lang == "en" else bucket["ru"]
    return key or "neutral"


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


def _profile_post_url(username: str, post_id: str) -> str | None:
    base = settings.telegram_web_app_url.strip().rstrip("/")
    if not base.startswith("https://"):
        return None
    safe_user = (username or "Moodie").strip() or "Moodie"
    return f"{base}/#/profile/{safe_user}?post={post_id}"


def _quick_menu_markup(lang: str) -> dict[str, Any]:
    if lang == "en":
        post_l, answer_l, today_l, status_l, feed_l = "📝 Post", "💬 Answer", "🌤 Today", "📊 Status", "📬 Feed"
    else:
        post_l, answer_l, today_l, status_l, feed_l = "📝 Пост", "💬 Ответ", "🌤 Вопрос", "📊 Статус", "📬 Лента"
    rows: list[list[dict[str, Any]]] = [
        [{"text": post_l, "callback_data": "cmd:post"}, {"text": answer_l, "callback_data": "cmd:answer"}],
        [{"text": today_l, "callback_data": "cmd:today"}, {"text": status_l, "callback_data": "cmd:status"}],
        [{"text": feed_l, "callback_data": "cmd:feed"}],
    ]
    base = _web_app_markup()
    if base:
        rows.extend(base["inline_keyboard"])
    return {"inline_keyboard": rows}


def _post_published_markup(username: str, post_id: str, lang: str) -> dict[str, Any] | None:
    rows: list[list[dict[str, Any]]] = []
    url = _profile_post_url(username, post_id)
    if url:
        label = "Open post" if lang == "en" else "Открыть пост"
        rows.append([{"text": label, "url": url}])
    base = _web_app_markup()
    if base:
        rows.extend(base["inline_keyboard"])
    return {"inline_keyboard": rows} if rows else None


def _streak_label(streak: int, lang: str) -> str:
    if lang == "en":
        return f"🔥 Streak: {streak} day{'s' if streak != 1 else ''}"
    if streak % 10 == 1 and streak % 100 != 11:
        word = "день"
    elif streak % 10 in (2, 3, 4) and streak % 100 not in (12, 13, 14):
        word = "дня"
    else:
        word = "дней"
    return f"🔥 Серия: {streak} {word}"


async def compute_activity_streak(db: Any, user: dict[str, Any]) -> int:
    user_id = user["_id"]
    days: set[str] = set()
    async for doc in db.dailyanswers.find({"userId": user_id}, {"dayKey": 1}):
        key = doc.get("dayKey")
        if isinstance(key, str):
            days.add(key)
    async for doc in db.posts.find({"userId": user_id, "hidden": {"$ne": True}}, {"createdAt": 1}):
        created = doc.get("createdAt")
        if isinstance(created, datetime):
            days.add(_local_day_key(user, created))
    if not days:
        return 0
    local_today = _local_now(user).date()
    d = local_today
    if d.isoformat() not in days:
        d = d - timedelta(days=1)
    streak = 0
    while d.isoformat() in days:
        streak += 1
        d -= timedelta(days=1)
    return streak


def _is_daily_question_reply(message: dict[str, Any]) -> bool:
    reply = message.get("reply_to_message")
    if not isinstance(reply, dict):
        return False
    text = reply.get("text")
    if not isinstance(text, str):
        return False
    markers = ("Вопрос дня", "Today's question", "Today's reflection question", "reflection question")
    return any(marker in text for marker in markers)


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


def _evening_due_now(user: dict[str, Any], value: datetime | None = None) -> bool:
    now = value or datetime.now(timezone.utc)
    if _in_quiet_hours(user, now):
        return False
    hour = _clamped_hour(user.get("telegramEveningNotifyHour"), 21)
    return _local_now(user, now).hour == hour


def _evening_review_markup(lang: str) -> dict[str, Any]:
    if lang == "en":
        labels = ("😮‍💨 Rough", "😐 Okay", "🙂 Good")
    else:
        labels = ("😮‍💨 Тяжёлый", "😐 Нормальный", "🙂 Хороший")
    return {
        "inline_keyboard": [
            [
                {"text": labels[0], "callback_data": "evening:hard"},
                {"text": labels[1], "callback_data": "evening:ok"},
                {"text": labels[2], "callback_data": "evening:good"},
            ]
        ]
    }


def _notify_status_text(user: dict[str, Any], lang: str) -> str:
    daily = bool(user.get("telegramDailyNotify"))
    activity = user.get("telegramActivityNotify") is not False and bool(user.get("telegramChatId") or user.get("telegramUserId"))
    evening = bool(user.get("telegramEveningNotify"))
    hour = _clamped_hour(user.get("telegramDailyNotifyHour"), settings.telegram_daily_notify_utc_hour)
    evening_hour = _clamped_hour(user.get("telegramEveningNotifyHour"), 21)
    quiet = bool(user.get("telegramQuietHoursEnabled"))
    q_start = _clamped_hour(user.get("telegramQuietStartHour"), 23)
    q_end = _clamped_hour(user.get("telegramQuietEndHour"), 9)
    if lang == "en":
        return (
            "🔔 Notification settings\n\n"
            f"🌤 Daily question: {'on' if daily else 'off'} · {hour:02d}:00 local\n"
            f"🌙 Evening review: {'on' if evening else 'off'} · {evening_hour:02d}:00 local\n"
            f"💬 Activity: {'on' if activity else 'off'} (max ~1 per 10 min)\n"
            f"📬 Following digest: once/day at daily hour\n"
            f"🌙 Quiet hours: {f'{q_start:02d}:00–{q_end:02d}:00' if quiet else 'off'}\n\n"
            "Use /daily on|off · /evening on|off · /activity on|off"
        )
    return (
        "🔔 Настройки уведомлений\n\n"
        f"🌤 Вопрос дня: {'вкл' if daily else 'выкл'} · {hour:02d}:00 локально\n"
        f"🌙 Вечерний разбор: {'вкл' if evening else 'выкл'} · {evening_hour:02d}:00 локально\n"
        f"💬 Активность: {'вкл' if activity else 'выкл'} (≈1 раз в 10 мин)\n"
        f"📬 Дайджест подписок: 1 раз/день в час вопроса дня\n"
        f"🌙 Тихие часы: {f'{q_start:02d}:00–{q_end:02d}:00' if quiet else 'выкл'}\n\n"
        "Команды: /daily on|off · /evening on|off · /activity on|off"
    )


def _notify_quick_text(user: dict[str, Any], lang: str) -> str:
    daily = bool(user.get("telegramDailyNotify"))
    activity = user.get("telegramActivityNotify") is not False and bool(user.get("telegramChatId") or user.get("telegramUserId"))
    if lang == "en":
        return (
            "⚡ Quick notifications\n\n"
            f"🌤 Daily: {'on' if daily else 'off'}\n"
            f"💬 Activity: {'on' if activity else 'off'}\n\n"
            "/daily on|off · /activity on|off · /settings for schedule"
        )
    return (
        "⚡ Быстрые уведомления\n\n"
        f"🌤 Вопрос дня: {'вкл' if daily else 'выкл'}\n"
        f"💬 Активность: {'вкл' if activity else 'выкл'}\n\n"
        "/daily on|off · /activity on|off · /settings — расписание"
    )


def _scope_quick_text(user: dict[str, Any], lang: str, scope: str) -> str:
    daily = bool(user.get("telegramDailyNotify"))
    activity = user.get("telegramActivityNotify") is not False and bool(user.get("telegramChatId") or user.get("telegramUserId"))
    if scope == "daily":
        state = "on" if daily else "off"
        if lang == "en":
            return f"🌤 Daily question reminders: {state}\n\n/daily on · /daily off"
        return f"🌤 Напоминания о вопросе дня: {'вкл' if daily else 'выкл'}\n\n/daily on · /daily off"
    if scope == "activity":
        state = "on" if activity else "off"
        if lang == "en":
            return f"💬 Activity alerts: {state}\n\n/activity on · /activity off"
        return f"💬 Уведомления об активности: {'вкл' if activity else 'выкл'}\n\n/activity on · /activity off"
    if scope == "evening":
        evening = bool(user.get("telegramEveningNotify"))
        state = "on" if evening else "off"
        if lang == "en":
            return f"🌙 Evening review: {state}\n\n/evening on · /evening off"
        return f"🌙 Вечерний разбор: {'вкл' if evening else 'выкл'}\n\n/evening on · /evening off"
    return _notify_quick_text(user, lang)


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

    async def _apply_notify_scope(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any],
        lang: str,
        scope: str,
        action: str,
    ) -> None:
        db = get_database()
        if action in ("on", "1", "true", "yes"):
            fields: dict[str, Any] = {"telegramChatId": int(chat_id), "updatedAt": datetime.now(timezone.utc)}
            if scope in {"all", "daily"}:
                fields["telegramDailyNotify"] = True
            if scope in {"all", "activity"}:
                fields["telegramActivityNotify"] = True
            if scope in {"all", "evening"}:
                fields["telegramEveningNotify"] = True
            await db.users.update_one({"_id": user["_id"]}, {"$set": fields})
            fresh = {**user, **fields}
            header = "✅ Notifications updated.\n\n" if lang == "en" else "✅ Уведомления обновлены.\n\n"
            await self.send_message(
                client,
                int(chat_id),
                header + _notify_status_text(fresh, lang),
                reply_markup=_settings_markup(fresh),
            )
            return

        if action in ("off", "0", "false", "no"):
            fields = {"updatedAt": datetime.now(timezone.utc)}
            if scope in {"all", "daily"}:
                fields["telegramDailyNotify"] = False
            if scope in {"all", "activity"}:
                fields["telegramActivityNotify"] = False
            if scope in {"all", "evening"}:
                fields["telegramEveningNotify"] = False
            await db.users.update_one({"_id": user["_id"]}, {"$set": fields})
            fresh = {**user, **fields}
            header = "✅ Notifications updated.\n\n" if lang == "en" else "✅ Уведомления обновлены.\n\n"
            await self.send_message(
                client,
                int(chat_id),
                header + _notify_status_text(fresh, lang),
                reply_markup=_settings_markup(fresh),
            )
            return

        await self.send_message(
            client,
            int(chat_id),
            _scope_quick_text(user, lang, scope),
            reply_markup=_settings_markup(user),
        )

    async def _require_linked_user(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any] | None,
        lang: str,
    ) -> dict[str, Any] | None:
        if user:
            return user
        await self.send_message(
            client,
            chat_id,
            "🔗 Link Telegram to your Moodie account first: open the mini app → Settings → Telegram."
            if lang == "en"
            else "🔗 Сначала привяжите Telegram в приложении: мини-приложение → Настройки → Telegram.",
            reply_markup=_web_app_markup(),
        )
        return None

    async def _cmd_post_prompt(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any],
        lang: str,
    ) -> None:
        db = get_database()
        if user.get("banned"):
            await self.send_message(
                client,
                chat_id,
                "⛔ This account is restricted." if lang == "en" else "⛔ Этот аккаунт ограничен.",
                reply_markup=_web_app_markup(),
            )
            return
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "telegramAwaitingPost": True,
                    "telegramAwaitingDailyAnswer": False,
                    "telegramChatId": chat_id,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
        if lang == "en":
            text = (
                "📝 Your next message will be published as a post in Moodie.\n\n"
                "Send the text (max 228 characters, no links). /cancel — abort."
            )
        else:
            text = (
                "📝 Следующее сообщение будет опубликовано как пост в Moodie.\n\n"
                "Пришлите текст (до 228 символов, без ссылок). /cancel — отменить."
            )
        await self.send_message(client, chat_id, text, reply_markup=_web_app_markup())

    async def _cmd_answer_prompt(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any],
        lang: str,
    ) -> None:
        db = get_database()
        if user.get("banned"):
            await self.send_message(
                client,
                chat_id,
                "⛔ This account is restricted." if lang == "en" else "⛔ Этот аккаунт ограничен.",
                reply_markup=_web_app_markup(),
            )
            return
        await db.users.update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "telegramAwaitingDailyAnswer": True,
                    "telegramAwaitingPost": False,
                    "telegramChatId": chat_id,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
        if lang == "en":
            text = (
                "💬 Send your answer to today's reflection question.\n\n"
                "Max 600 characters, no links. /cancel — abort."
            )
        else:
            text = (
                "💬 Пришлите ответ на сегодняшний вопрос для размышления.\n\n"
                "До 600 символов, без ссылок. /cancel — отменить."
            )
        await self.send_message(client, chat_id, text, reply_markup=_web_app_markup())

    async def _submit_daily_answer_message(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any],
        lang: str,
        text: str,
    ) -> None:
        db = get_database()
        try:
            result = await submit_daily_answer(db, user, text, lang=lang)
        except HTTPException as exc:
            err_detail = exc.detail
            err_msg = err_detail.get("message") if isinstance(err_detail, dict) else str(err_detail)
            await self.send_message(client, chat_id, str(err_msg), reply_markup=_web_app_markup())
            return
        except Exception:
            logger.exception("telegram submit_daily_answer failed")
            await self.send_message(
                client,
                chat_id,
                "Could not save answer. Try again." if lang == "en" else "Не удалось сохранить ответ. Попробуйте ещё раз.",
                reply_markup=_web_app_markup(),
            )
            return
        await db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"telegramAwaitingDailyAnswer": False, "updatedAt": datetime.now(timezone.utc)}},
        )
        if lang == "en":
            msg = "Answer updated." if result.get("updated") else "Answer saved. Thank you for sharing."
        else:
            msg = "Ответ обновлён." if result.get("updated") else "Ответ сохранён. Спасибо, что поделились."
        await self.send_message(client, chat_id, msg, reply_markup=_web_app_markup())

    async def _cmd_today(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any] | None,
        lang: str,
        *,
        set_awaiting_answer: bool = False,
    ) -> None:
        db = get_database()
        day_key = utc_day_key()
        bucket = get_mood_bucket((user or {}).get("currentEmotion"))
        question = pick_question(day_key, bucket, lang)
        if lang == "en":
            line = f"🌤 Today's question\n\n{question}"
            if set_awaiting_answer and user:
                line += "\n\nReply with your answer or use /answer."
        else:
            line = f"🌤 Вопрос дня\n\n{question}"
            if set_awaiting_answer and user:
                line += "\n\nОтветьте на это сообщение или используйте /answer."
        markup = _settings_markup(user)
        if set_awaiting_answer and user and not user.get("banned"):
            await db.users.update_one(
                {"_id": user["_id"]},
                {
                    "$set": {
                        "telegramAwaitingDailyAnswer": True,
                        "telegramAwaitingPost": False,
                        "telegramChatId": chat_id,
                        "updatedAt": datetime.now(timezone.utc),
                    }
                },
            )
        await self.send_message(client, chat_id, line, reply_markup=markup)

    async def _cmd_status(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any],
        lang: str,
    ) -> None:
        db = get_database()
        username = user.get("username") or "Moodie"
        emotion = _emotion_label(user.get("currentEmotion"), lang)
        emoji = user.get("currentEmoji") or "😐"
        streak = await compute_activity_streak(db, user)
        last_post = await db.posts.find_one({"userId": user["_id"], "hidden": {"$ne": True}}, sort=[("createdAt", -1)])
        if lang == "en":
            lines = [
                f"📊 Status — @{username}",
                f"💭 Mood: {emoji} {emotion}",
                _streak_label(streak, lang),
                "",
                _notify_status_text(user, lang),
            ]
            if last_post:
                snippet = str(last_post.get("text") or "")[:120]
                when = last_post.get("createdAt")
                when_s = when.strftime("%Y-%m-%d %H:%M") if isinstance(when, datetime) else "—"
                lines.insert(4, f"📝 Last post ({when_s}):\n{snippet}")
            else:
                lines.insert(4, "📝 No posts yet.")
        else:
            lines = [
                f"📊 Статус — @{username}",
                f"💭 Настроение: {emoji} {emotion}",
                _streak_label(streak, lang),
                "",
                _notify_status_text(user, lang),
            ]
            if last_post:
                snippet = str(last_post.get("text") or "")[:120]
                when = last_post.get("createdAt")
                when_s = when.strftime("%Y-%m-%d %H:%M") if isinstance(when, datetime) else "—"
                lines.insert(4, f"📝 Последний пост ({when_s}):\n{snippet}")
            else:
                lines.insert(4, "📝 Постов пока нет.")
        await self.send_message(client, chat_id, "\n".join(lines), reply_markup=_settings_markup(user))

    async def _cmd_feed(
        self,
        client: httpx.AsyncClient,
        chat_id: int,
        user: dict[str, Any] | None,
        lang: str,
    ) -> None:
        db = get_database()
        banned_ids = await banned_user_ids(db)
        excluded = excluded_author_ids(banned_ids, user)
        query: dict[str, Any] = {"hidden": {"$ne": True}}
        if excluded:
            query["userId"] = {"$nin": excluded}
        posts = (
            await db.posts.find(query, projection_without_private())
            .sort([("feedSortScore", -1), ("createdAt", -1)])
            .limit(3)
            .to_list(3)
        )
        if not posts:
            await self.send_message(
                client,
                chat_id,
                "📬 The feed is empty for now." if lang == "en" else "📬 Лента пока пуста.",
                reply_markup=_web_app_markup(),
            )
            return
        author_ids = list({p.get("userId") for p in posts if p.get("userId") is not None})
        authors: dict[str, str] = {}
        async for author in db.users.find({"_id": {"$in": author_ids}}, {"username": 1}):
            authors[str(author["_id"])] = author.get("username") or "Moodie"
        if lang == "en":
            lines = ["📬 Latest from the feed", ""]
        else:
            lines = ["📬 Последнее из ленты", ""]
        for idx, post in enumerate(posts, start=1):
            author_name = authors.get(str(post.get("userId")), "Moodie")
            snippet = str(post.get("text") or "").replace("\n", " ")[:100]
            emo = _emotion_label(post.get("emotion"), lang)
            lines.append(f"{idx}. @{author_name} · {emo}\n{snippet}")
        await self.send_message(client, chat_id, "\n".join(lines), reply_markup=_web_app_markup())

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
        if len(parts) == 2 and parts[0] == "cmd":
            chat = (callback.get("message") or {}).get("chat") or {}
            chat_id = chat.get("id")
            await self.answer_callback_query(client, str(callback_id), "")
            if chat_id is None:
                return
            cmd_name = parts[1]
            if user.get("banned") and cmd_name in {"post", "answer", "feed"}:
                await self.send_message(
                    client,
                    int(chat_id),
                    "⛔ This account is restricted." if lang == "en" else "⛔ Этот аккаунт ограничен.",
                    reply_markup=_web_app_markup(),
                )
                return
            if cmd_name in {"post", "answer", "status"}:
                linked = await self._require_linked_user(client, int(chat_id), user, lang)
                if not linked:
                    return
                user = linked
            if cmd_name == "post":
                await self._cmd_post_prompt(client, int(chat_id), user, lang)
            elif cmd_name == "answer":
                await self._cmd_answer_prompt(client, int(chat_id), user, lang)
            elif cmd_name == "today":
                await self._cmd_today(client, int(chat_id), user, lang, set_awaiting_answer=bool(user))
            elif cmd_name == "status":
                await self._cmd_status(client, int(chat_id), user, lang)
            elif cmd_name == "feed":
                await self._cmd_feed(client, int(chat_id), user, lang)
            return

        if len(parts) == 2 and parts[0] == "evening" and parts[1] in {"hard", "ok", "good"}:
            choice = parts[1]
            day_key = _local_day_key(user)
            saved = await save_evening_review(db, user["_id"], day_key, choice)
            label = evening_choice_label(choice, lang)
            await self.answer_callback_query(
                client,
                str(callback_id),
                "Saved" if lang == "en" else "Сохранено",
            )
            chat = (callback.get("message") or {}).get("chat") or {}
            message_id = (callback.get("message") or {}).get("message_id")
            chat_id = chat.get("id")
            weekly = user.get("weeklyAiSummary")
            weekly_text = weekly.strip() if isinstance(weekly, str) else ""
            if lang == "en":
                lines = [f"🌙 Thanks — you marked the day as «{label}»."]
                if weekly_text:
                    lines.extend(["", "📊 Your week in brief:", weekly_text[:420]])
                else:
                    lines.append("\nOpen your profile in Moodie for the weekly AI summary.")
            else:
                lines = [f"🌙 Спасибо — день отмечен как «{label}»."]
                if weekly_text:
                    lines.extend(["", "📊 Кратко за неделю:", weekly_text[:420]])
                else:
                    lines.append("\nОткройте профиль в Moodie — там вывод ИИ за неделю.")
            if chat_id is not None and message_id is not None:
                try:
                    await self.edit_message_text(client, int(chat_id), int(message_id), "\n".join(lines))
                except Exception:
                    await self.send_message(client, int(chat_id), "\n".join(lines), reply_markup=_web_app_markup())
            elif chat_id is not None:
                await self.send_message(client, int(chat_id), "\n".join(lines), reply_markup=_web_app_markup())
            if not saved:
                logger.warning("evening review save failed for user %s", user.get("_id"))
            return

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
            elif user and user.get("telegramAwaitingDailyAnswer"):
                if lang == "en":
                    await reply("Please send text for your answer (not a photo or sticker).")
                else:
                    await reply("Пришлите текст ответа (не фото и не стикер).")
            return

        cmd, arg = _parse_command(text_raw)

        if not cmd and user and user.get("telegramAwaitingDailyAnswer"):
            if user.get("banned"):
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"telegramAwaitingDailyAnswer": False, "updatedAt": datetime.now(timezone.utc)}},
                )
                await reply("⛔ This account is restricted." if lang == "en" else "⛔ Этот аккаунт ограничен.", with_app=True)
            else:
                await self._submit_daily_answer_message(client, int(chat_id), user, lang, text_raw)
            return

        if not cmd and user and _is_daily_question_reply(message):
            if not user.get("banned"):
                await self._submit_daily_answer_message(client, int(chat_id), user, lang, text_raw)
            return

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
                emotion_label = _emotion_label(emotion, lang)
                post_id = str(created.get("id") or created.get("_id") or "")
                username = user.get("username") or "Moodie"
                if lang == "en":
                    msg = f"Published\nYour mood: {emotion_label}"
                else:
                    msg = f"Опубликовано\nВаша эмоция: {emotion_label}"
                post_markup = _post_published_markup(username, post_id, lang) if post_id else markup
                await self.send_message(client, int(chat_id), msg, reply_markup=post_markup)
            return

        if not cmd:
            return

        if cmd == "start":
            if lang == "en":
                await self.send_message(
                    client,
                    int(chat_id),
                    "👋 Hi! I’m the Moodie bot — open the mini app to post, read the feed, "
                    "and answer the daily question.\n\n"
                    "✨ Use /help for commands. Turn on a daily reminder with /daily on "
                    "(requires a linked Moodie account).",
                    reply_markup=_quick_menu_markup(lang),
                )
            else:
                await self.send_message(
                    client,
                    int(chat_id),
                    "👋 Привет! Я бот Moodie — откройте мини-приложение, чтобы постить, "
                    "читать ленту и отвечать на вопрос дня.\n\n"
                    "✨ Команды: /help. Ежедневное напоминание: /daily on "
                    "(нужен привязанный аккаунт Moodie).",
                    reply_markup=_quick_menu_markup(lang),
                )
            return

        if cmd == "help":
            if lang == "en":
                await self.send_message(
                    client,
                    int(chat_id),
                    "🧭 Commands\n\n"
                    "/start — intro\n"
                    "/app — open Moodie\n"
                    "/post — next message becomes your post\n"
                    "/answer — reply to today's question\n"
                    "/cancel — cancel /post or /answer draft\n"
                    "/status — mood, streak, last post, notifications\n"
                    "/feed — last 3 posts from the feed\n"
                    "/today — today’s reflection question + Open button\n"
                    "/song — your current mood song\n"
                    "/notify on|off — all notifications\n"
                    "/daily on|off — daily question reminder\n"
                    "/activity on|off — follows, comments, support\n"
                    "/settings — notification status\n"
                    "/me — linked account info",
                    reply_markup=_quick_menu_markup(lang),
                )
            else:
                await self.send_message(
                    client,
                    int(chat_id),
                    "🧭 Команды\n\n"
                    "/start — знакомство\n"
                    "/app — открыть Moodie\n"
                    "/post — следующее сообщение станет постом\n"
                    "/answer — ответ на вопрос дня\n"
                    "/cancel — отменить черновик /post или /answer\n"
                    "/status — настроение, серия, последний пост, уведомления\n"
                    "/feed — последние 3 поста из ленты\n"
                    "/today — вопрос дня + кнопка «Открыть»\n"
                    "/song — текущая песня настроения\n"
                    "/notify on|off — все уведомления\n"
                    "/daily on|off — напоминание о вопросе дня\n"
                    "/activity on|off — подписки, комментарии, поддержка\n"
                    "/settings — статус уведомлений\n"
                    "/me — информация о привязке",
                    reply_markup=_quick_menu_markup(lang),
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
            await self._cmd_post_prompt(client, int(chat_id), user, lang)
            return

        if cmd == "answer":
            if not user:
                await reply(
                    "🔗 Link Telegram to your Moodie account first: open the mini app → Settings → Telegram."
                    if lang == "en"
                    else "🔗 Сначала привяжите Telegram в приложении: мини-приложение → Настройки → Telegram.",
                    with_app=True,
                )
                return
            await self._cmd_answer_prompt(client, int(chat_id), user, lang)
            return

        if cmd == "cancel":
            had_post = bool(user and user.get("telegramAwaitingPost"))
            had_answer = bool(user and user.get("telegramAwaitingDailyAnswer"))
            if user:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "telegramAwaitingPost": False,
                            "telegramAwaitingDailyAnswer": False,
                            "updatedAt": datetime.now(timezone.utc),
                        }
                    },
                )
            if lang == "en":
                if had_post or had_answer:
                    await reply("Cancelled.", with_app=True)
                else:
                    await reply("No draft to cancel.", with_app=True)
            else:
                if had_post or had_answer:
                    await reply("Отменено.", with_app=True)
                else:
                    await reply("Нет черновика.", with_app=True)
            return

        if cmd == "today":
            await self._cmd_today(client, int(chat_id), user, lang, set_awaiting_answer=bool(user and not user.get("banned")))
            return

        if cmd == "feed":
            await self._cmd_feed(client, int(chat_id), user, lang)
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

        if cmd == "status":
            if not user:
                await reply(
                    "🔗 Telegram is not linked to a Moodie account." if lang == "en" else "🔗 Telegram не привязан к аккаунту Moodie.",
                    with_app=True,
                )
                return
            await self._cmd_status(client, int(chat_id), user, lang)
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

        if cmd in {"notify", "daily", "activity", "evening"}:
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

            if cmd == "daily":
                scope = "daily"
                action = arg.strip().lower()
            elif cmd == "activity":
                scope = "activity"
                action = arg.strip().lower()
            elif cmd == "evening":
                scope = "evening"
                action = arg.strip().lower()
            else:
                parts = arg.split()
                scope = parts[0] if parts and parts[0] in {"daily", "activity", "evening"} else "all"
                action = parts[1] if scope != "all" and len(parts) > 1 else (parts[0] if parts else "")

            await self._apply_notify_scope(client, int(chat_id), user, lang, scope, action)
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


async def run_evening_reviews(runner: TelegramBotRunner) -> None:
    db = get_database()
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        cursor = db.users.find(
            {
                "telegramEveningNotify": True,
                "telegramUserId": {"$exists": True, "$ne": None},
                "banned": {"$ne": True},
            }
        )
        async for user in cursor:
            if not _evening_due_now(user, now):
                continue
            day_key = _local_day_key(user, now)
            claim = await db.users.update_one(
                {
                    "_id": user["_id"],
                    "telegramEveningNotify": True,
                    "banned": {"$ne": True},
                    "$or": [
                        {"lastEveningReviewDayKey": {"$exists": False}},
                        {"lastEveningReviewDayKey": {"$ne": day_key}},
                    ],
                },
                {"$set": {"lastEveningReviewDayKey": day_key, "updatedAt": datetime.now(timezone.utc)}},
            )
            if claim.modified_count == 0:
                continue

            lang = "en" if user.get("preferredLanguage") == "en" else "ru"
            chat_id = _chat_id_for_delivery(user, int(user["telegramUserId"]))
            if lang == "en":
                text = "🌙 How was your day?\n\nTap one — it stays between you and Moodie."
            else:
                text = "🌙 Как прошёл день?\n\nНажмите вариант — это только между вами и Moodie."
            markup = _evening_review_markup(lang)
            app = _web_app_markup()
            if app:
                markup["inline_keyboard"].extend(app["inline_keyboard"])
            try:
                await runner.send_message(client, chat_id, text, reply_markup=markup)
            except Exception:
                logger.exception("evening review send failed for user %s", user.get("_id"))
                await db.users.update_one({"_id": user["_id"]}, {"$unset": {"lastEveningReviewDayKey": ""}})
            await asyncio.sleep(0.06)


async def run_following_digests(runner: TelegramBotRunner) -> None:
    db = get_database()
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=24)
    markup = _web_app_markup()
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        cursor = db.users.find(
            {
                "telegramActivityNotify": {"$ne": False},
                "telegramUserId": {"$exists": True, "$ne": None},
                "following.0": {"$exists": True},
                "banned": {"$ne": True},
            }
        )
        async for user in cursor:
            if not _daily_due_now(user, now):
                continue
            digest_day = _local_day_key(user, now)
            claim = await db.users.update_one(
                {
                    "_id": user["_id"],
                    "telegramActivityNotify": {"$ne": False},
                    "banned": {"$ne": True},
                    "$or": [
                        {"lastFollowingDigestDayKey": {"$exists": False}},
                        {"lastFollowingDigestDayKey": {"$ne": digest_day}},
                    ],
                },
                {"$set": {"lastFollowingDigestDayKey": digest_day, "updatedAt": datetime.now(timezone.utc)}},
            )
            if claim.modified_count == 0:
                continue

            following = user.get("following") or []
            posts = (
                await db.posts.find(
                    {"userId": {"$in": following}, "hidden": {"$ne": True}, "createdAt": {"$gte": since}},
                )
                .sort("createdAt", -1)
                .limit(3)
                .to_list(3)
            )
            if not posts:
                await db.users.update_one({"_id": user["_id"]}, {"$unset": {"lastFollowingDigestDayKey": ""}})
                continue

            author_ids = list({p.get("userId") for p in posts if p.get("userId") is not None})
            authors: dict[str, str] = {}
            async for author in db.users.find({"_id": {"$in": author_ids}}, {"username": 1}):
                authors[str(author["_id"])] = author.get("username") or "Moodie"

            lang = "en" if user.get("preferredLanguage") == "en" else "ru"
            chat_id = _chat_id_for_delivery(user, int(user["telegramUserId"]))
            if lang == "en":
                lines = ["📬 From people you follow (last 24h)", ""]
            else:
                lines = ["📬 От тех, на кого вы подписаны (за 24 ч)", ""]

            for idx, post in enumerate(posts, start=1):
                author_name = authors.get(str(post.get("userId")), "Moodie")
                snippet = str(post.get("text") or "").replace("\n", " ")[:100]
                emo = _emotion_label(post.get("emotion"), lang)
                lines.append(f"{idx}. @{author_name} · {emo}\n{snippet}")

            try:
                await runner.send_message(client, chat_id, "\n".join(lines), reply_markup=markup)
            except Exception:
                logger.exception("following digest failed for user %s", user.get("_id"))
                await db.users.update_one({"_id": user["_id"]}, {"$unset": {"lastFollowingDigestDayKey": ""}})
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
            await run_evening_reviews(runner)
            await run_following_digests(runner)
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
