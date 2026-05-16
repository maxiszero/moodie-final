"""Validate Telegram Mini App initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from typing import Any
from urllib.parse import parse_qsl

_MAX_AUTH_AGE_SEC = 86400


def _secret_key(bot_token: str) -> bytes:
    return hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()


def validate_webapp_init_data(init_data: str, bot_token: str, max_age_sec: int = _MAX_AUTH_AGE_SEC) -> dict[str, Any]:
    if not bot_token.strip():
        raise ValueError("Bot token is not configured")
    if not init_data or not isinstance(init_data, str):
        raise ValueError("initData is required")

    pairs = parse_qsl(init_data, keep_blank_values=True)
    data: dict[str, str] = dict(pairs)
    received_hash = data.pop("hash", None)
    data.pop("signature", None)
    if not received_hash:
        raise ValueError("Missing hash")

    auth_raw = data.get("auth_date")
    if not auth_raw:
        raise ValueError("Missing auth_date")
    try:
        auth_date = int(auth_raw)
    except ValueError as e:
        raise ValueError("Invalid auth_date") from e
    if time.time() - auth_date > max_age_sec:
        raise ValueError("initData expired")

    check_parts = [f"{k}={v}" for k, v in sorted(data.items())]
    data_check_string = "\n".join(check_parts)

    secret = _secret_key(bot_token)
    calculated = hmac.new(secret, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calculated, received_hash):
        raise ValueError("Invalid initData signature")

    user_raw = data.get("user")
    if not user_raw:
        raise ValueError("Missing user in initData")
    try:
        user_obj = json.loads(user_raw)
    except json.JSONDecodeError as e:
        raise ValueError("Invalid user JSON") from e
    tg_id = user_obj.get("id")
    if tg_id is None:
        raise ValueError("Missing user id")
    try:
        tg_id_int = int(tg_id)
    except (TypeError, ValueError) as e:
        raise ValueError("Invalid user id") from e

    username = user_obj.get("username")
    return {
        "telegram_user_id": tg_id_int,
        "telegram_username": username if isinstance(username, str) and username else None,
        "auth_date": auth_date,
    }
