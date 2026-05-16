"""Telegram bot: getUpdates loop and daily question reminders for opted-in users."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from ..config import settings
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

    async def handle_private_message(self, client: httpx.AsyncClient, message: dict[str, Any]) -> None:
        chat = message.get("chat") or {}
        if chat.get("type") != "private":
            return
        from_user = message.get("from") or {}
        chat_id = chat.get("id")
        tg_uid = from_user.get("id")
        if chat_id is None or tg_uid is None:
            return

        text_raw = message.get("text")
        if not isinstance(text_raw, str):
            return

        cmd, arg = _parse_command(text_raw)
        if not cmd:
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

        if cmd == "start":
            if lang == "en":
                await reply(
                    "Hi! I’m the Moodie bot — open the mini app to post, read the feed, "
                    "and answer the daily question.\n\n"
                    "Use /help for commands. Turn on a daily reminder with /notify on "
                    "(requires a linked Moodie account).",
                )
            else:
                await reply(
                    "Привет! Я бот Moodie — откройте мини-приложение, чтобы постить, "
                    "читать ленту и отвечать на вопрос дня.\n\n"
                    "Команды: /help. Ежедневное напоминание: /notify on "
                    "(нужен привязанный аккаунт Moodie).",
                )
            return

        if cmd == "help":
            if lang == "en":
                await reply(
                    "/start — intro\n"
                    "/app — open Moodie\n"
                    "/today — today’s reflection question + Open button\n"
                    "/notify on|off — daily reminder at a fixed UTC time (linked account only)",
                )
            else:
                await reply(
                    "/start — знакомство\n"
                    "/app — открыть Moodie\n"
                    "/today — вопрос дня + кнопка «Открыть»\n"
                    "/notify on|off — напоминание раз в сутки (нужен связанный аккаунт)",
                )
            return

        if cmd == "app":
            if lang == "en":
                await reply("Open Moodie:", with_app=True)
            else:
                await reply("Откройте Moodie:", with_app=True)
            return

        if cmd == "today":
            day_key = utc_day_key()
            bucket = get_mood_bucket((user or {}).get("currentEmotion"))
            question = pick_question(day_key, bucket, lang)
            if lang == "en":
                line = f"Today's question\n\n{question}"
            else:
                line = f"Вопрос дня\n\n{question}"
            await reply(line, with_app=True)
            return

        if cmd == "notify":
            if not user:
                if lang == "en":
                    await reply(
                        "Link Telegram to your Moodie account first: open the mini app → Settings → Telegram.",
                        with_app=True,
                    )
                else:
                    await reply(
                        "Сначала привяжите Telegram в приложении: мини-приложение → Настройки → Telegram.",
                        with_app=True,
                    )
                return
            if user.get("banned"):
                if lang == "en":
                    await reply("This account is restricted.")
                else:
                    await reply("Этот аккаунт ограничен.")
                return

            if arg in ("on", "1", "true", "yes"):
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "telegramDailyNotify": True,
                            "telegramChatId": int(chat_id),
                            "updatedAt": datetime.now(timezone.utc),
                        }
                    },
                )
                if lang == "en":
                    await reply("Daily question reminders are on. You’ll get one message per day (UTC).", with_app=True)
                else:
                    await reply(
                        "Напоминания о вопросе дня включены. Одно сообщение в сутки (по UTC).",
                        with_app=True,
                    )
                return

            if arg in ("off", "0", "false", "no"):
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {
                            "telegramDailyNotify": False,
                            "updatedAt": datetime.now(timezone.utc),
                        }
                    },
                )
                if lang == "en":
                    await reply("Daily reminders are off.", with_app=True)
                else:
                    await reply("Напоминания выключены.", with_app=True)
                return

            on = bool(user.get("telegramDailyNotify"))
            if lang == "en":
                await reply(
                    f"Daily reminders: {'on' if on else 'off'}. Use /notify on or /notify off.",
                    with_app=True,
                )
            else:
                await reply(
                    f"Напоминания: {'вкл' if on else 'выкл'}. Команды: /notify on или /notify off.",
                    with_app=True,
                )
            return


async def run_daily_notifies(runner: TelegramBotRunner) -> None:
    db = get_database()
    day_key = utc_day_key()
    markup = _web_app_markup()
    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=15.0)) as client:
        cursor = db.users.find(
            {
                "telegramDailyNotify": True,
                "telegramUserId": {"$exists": True, "$ne": None},
                "banned": {"$ne": True},
            }
        )
        async for user in cursor:
            claim = await db.users.update_one(
                {
                    "_id": user["_id"],
                    "telegramDailyNotify": True,
                    "banned": {"$ne": True},
                    "$or": [
                        {"lastDailyNotifyDayKey": {"$exists": False}},
                        {"lastDailyNotifyDayKey": {"$ne": day_key}},
                    ],
                },
                {"$set": {"lastDailyNotifyDayKey": day_key, "updatedAt": datetime.now(timezone.utc)}},
            )
            if claim.modified_count == 0:
                continue

            lang = "en" if user.get("preferredLanguage") == "en" else "ru"
            bucket = get_mood_bucket(user.get("currentEmotion"))
            question = pick_question(day_key, bucket, lang)
            chat_id = _chat_id_for_delivery(user, int(user["telegramUserId"]))
            if lang == "en":
                text = f"Today's reflection question\n\n{question}"
            else:
                text = f"Вопрос дня\n\n{question}"

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
    hour = settings.telegram_daily_notify_utc_hour % 24
    while True:
        now = datetime.now(timezone.utc)
        target = now.replace(hour=hour, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        wait_s = (target - now).total_seconds()
        logger.info("Daily Telegram reminders next run at %s (in %.0fs)", target.isoformat(), wait_s)
        await asyncio.sleep(wait_s)
        try:
            await run_daily_notifies(runner)
        except Exception:
            logger.exception("run_daily_notifies failed")


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
