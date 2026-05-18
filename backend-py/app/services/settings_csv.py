"""
Импорт / экспорт настроек пользователя в CSV (явное чтение и запись файла на диске / в поток).

Подходит под учебное требование «работа с внешними CSV» при том, что основное хранилище — MongoDB.
"""
from __future__ import annotations

import csv
import io
from typing import Any

CSV_HEADERS = [
    "preferredLanguage",
    "preferredTheme",
    "telegramDailyNotify",
    "telegramActivityNotify",
    "telegramDailyNotifyHour",
    "telegramQuietHoursEnabled",
    "telegramQuietStartHour",
    "telegramQuietEndHour",
]


def _bool_to_cell(v: Any) -> str:
    return "true" if v else "false"


def user_doc_to_row(user: dict[str, Any]) -> dict[str, str]:
    """Строит одну строку CSV из документа пользователя в MongoDB."""
    hour = user.get("telegramDailyNotifyHour")
    q_start = user.get("telegramQuietStartHour")
    q_end = user.get("telegramQuietEndHour")
    try:
        hour_n = int(hour) if hour is not None and hour != "" else 9
    except (TypeError, ValueError):
        hour_n = 9
    try:
        qs = int(q_start) if q_start is not None and q_start != "" else 22
    except (TypeError, ValueError):
        qs = 22
    try:
        qe = int(q_end) if q_end is not None and q_end != "" else 8
    except (TypeError, ValueError):
        qe = 8
    hour_n = max(0, min(23, hour_n))
    qs = max(0, min(23, qs))
    qe = max(0, min(23, qe))

    return {
        "preferredLanguage": str(user.get("preferredLanguage") or "ru"),
        "preferredTheme": str(user.get("preferredTheme") or "light"),
        "telegramDailyNotify": _bool_to_cell(user.get("telegramDailyNotify")),
        "telegramActivityNotify": _bool_to_cell(user.get("telegramActivityNotify")),
        "telegramDailyNotifyHour": str(hour_n),
        "telegramQuietHoursEnabled": _bool_to_cell(user.get("telegramQuietHoursEnabled")),
        "telegramQuietStartHour": str(qs),
        "telegramQuietEndHour": str(qe),
    }


def row_to_csv_bytes(row: dict[str, str]) -> bytes:
    """Сериализация одной строки настроек в UTF-8 CSV (для скачивания)."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=CSV_HEADERS, lineterminator="\n")
    writer.writeheader()
    writer.writerow({k: row.get(k, "") for k in CSV_HEADERS})
    return buf.getvalue().encode("utf-8")


def _parse_bool_cell(raw: str) -> bool:
    x = raw.strip().lower()
    if x in ("true", "1", "yes", "on"):
        return True
    if x in ("false", "0", "no", "off"):
        return False
    raise ValueError(f"Invalid boolean value in CSV: {raw!r} (use true/false)")


def _parse_hour_cell(raw: str) -> int:
    n = int(raw.strip())
    if n < 0 or n > 23:
        raise ValueError(f"Hour must be 0–23, got {n}")
    return n


def parse_csv_to_updates(text: str) -> dict[str, Any]:
    """
    Разбор CSV: первая строка данных после заголовка.
    Возвращает поля для $set в MongoDB. Пустые ячейки пропускаются.
    """
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("CSV has no header row")

    header_set = {h.strip() for h in reader.fieldnames if h and h.strip()}
    unknown = header_set - set(CSV_HEADERS)
    if unknown:
        raise ValueError(f"Unknown columns: {', '.join(sorted(unknown))}")

    rows = list(reader)
    if not rows:
        raise ValueError("CSV has no data rows")

    raw = rows[0]
    updates: dict[str, Any] = {}

    def get_cell(key: str) -> str | None:
        if key not in raw:
            return None
        v = raw[key]
        if v is None:
            return None
        s = str(v).strip()
        return s if s else None

    lang = get_cell("preferredLanguage")
    if lang is not None:
        lang = lang.lower()
        if lang not in ("ru", "en"):
            raise ValueError("preferredLanguage must be ru or en")
        updates["preferredLanguage"] = lang

    theme = get_cell("preferredTheme")
    if theme is not None:
        theme = theme.lower()
        if theme not in ("light", "dark"):
            raise ValueError("preferredTheme must be light or dark")
        updates["preferredTheme"] = theme

    cell = get_cell("telegramDailyNotify")
    if cell is not None:
        updates["telegramDailyNotify"] = _parse_bool_cell(cell)

    cell = get_cell("telegramActivityNotify")
    if cell is not None:
        updates["telegramActivityNotify"] = _parse_bool_cell(cell)

    cell = get_cell("telegramDailyNotifyHour")
    if cell is not None:
        updates["telegramDailyNotifyHour"] = _parse_hour_cell(cell)

    cell = get_cell("telegramQuietHoursEnabled")
    if cell is not None:
        updates["telegramQuietHoursEnabled"] = _parse_bool_cell(cell)

    cell = get_cell("telegramQuietStartHour")
    if cell is not None:
        updates["telegramQuietStartHour"] = _parse_hour_cell(cell)

    cell = get_cell("telegramQuietEndHour")
    if cell is not None:
        updates["telegramQuietEndHour"] = _parse_hour_cell(cell)

    return updates
