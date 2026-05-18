"""Тесты модуля settings_csv (CSV без Mongo)."""
import io

import pytest

from app.services.settings_csv import (
    CSV_HEADERS,
    parse_csv_to_updates,
    row_to_csv_bytes,
    user_doc_to_row,
)


def test_user_doc_to_row_defaults() -> None:
    row = user_doc_to_row({})
    assert row["preferredLanguage"] == "ru"
    assert row["preferredTheme"] == "light"
    assert row["telegramDailyNotify"] == "false"


def test_roundtrip_csv_content() -> None:
    doc = {
        "preferredLanguage": "en",
        "preferredTheme": "dark",
        "telegramDailyNotify": True,
        "telegramActivityNotify": False,
        "telegramDailyNotifyHour": 14,
        "telegramQuietHoursEnabled": True,
        "telegramQuietStartHour": 23,
        "telegramQuietEndHour": 7,
    }
    b = row_to_csv_bytes(user_doc_to_row(doc))
    text = b.decode("utf-8")
    updates = parse_csv_to_updates(text)
    assert updates["preferredLanguage"] == "en"
    assert updates["preferredTheme"] == "dark"
    assert updates["telegramDailyNotify"] is True
    assert updates["telegramActivityNotify"] is False
    assert updates["telegramDailyNotifyHour"] == 14
    assert updates["telegramQuietHoursEnabled"] is True
    assert updates["telegramQuietStartHour"] == 23
    assert updates["telegramQuietEndHour"] == 7


def test_parse_rejects_unknown_column() -> None:
    buf = io.StringIO()
    buf.write("preferredLanguage,bogus\n")
    buf.write("ru,nope\n")
    buf.seek(0)
    with pytest.raises(ValueError, match="Unknown columns"):
        parse_csv_to_updates(buf.read())


def test_csv_has_exact_header_order_in_output() -> None:
    b = row_to_csv_bytes(user_doc_to_row({}))
    first = b.decode("utf-8").splitlines()[0]
    assert first == ",".join(CSV_HEADERS)


def test_parse_empty_csv_data_raises() -> None:
    text = ",".join(CSV_HEADERS) + "\n"
    with pytest.raises(ValueError, match="no data rows"):
        parse_csv_to_updates(text)


def test_parse_invalid_language_raises() -> None:
    text = "preferredLanguage,preferredTheme\nxx,light\n"
    with pytest.raises(ValueError, match="preferredLanguage"):
        parse_csv_to_updates(text)


def test_parse_invalid_theme_raises() -> None:
    text = "preferredLanguage,preferredTheme\nru,neon\n"
    with pytest.raises(ValueError, match="preferredTheme"):
        parse_csv_to_updates(text)


def test_partial_row_updates_only_present_fields() -> None:
    """Только указанные колонки попадают в updates (остальные пустыми не затираются логикой парсера)."""
    text = "preferredLanguage,preferredTheme\nen,\n"
    u = parse_csv_to_updates(text)
    assert u == {"preferredLanguage": "en"}


def test_parse_invalid_bool_raises() -> None:
    text = "preferredLanguage,preferredTheme,telegramDailyNotify\nru,light,maybe\n"
    with pytest.raises(ValueError, match="Invalid boolean"):
        parse_csv_to_updates(text)


def test_parse_hour_out_of_range_raises() -> None:
    text = "preferredLanguage,preferredTheme,telegramDailyNotifyHour\nru,light,99\n"
    with pytest.raises(ValueError, match="Hour must"):
        parse_csv_to_updates(text)
