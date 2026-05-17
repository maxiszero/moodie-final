from fastapi.testclient import TestClient
from datetime import datetime, timezone

from app.main import create_app
from app.services.ai import WeeklyPost, estimate_feed_quality, fallback_analysis, weekly_summary_fallback
from app.services.mood_song import normalize_emotion, query_for_mood, song_payload, MoodSong
from app.services.telegram_webapp import validate_webapp_init_data
from app.services.telegram_bot import _daily_due_now, _in_quiet_hours, _local_day_key


def test_telegram_init_data_rejects_garbage() -> None:
    try:
        validate_webapp_init_data("auth_date=1&hash=deadbeef", "token")
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_health() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_validation_runs_before_database() -> None:
    client = TestClient(create_app())

    response = client.post("/api/auth/register", json={"username": "ab", "password": "123456"})

    assert response.status_code == 400
    assert response.json()["message"] == "Username must be 3-24 characters"


def test_ai_fallback_detects_positive_mood() -> None:
    result = fallback_analysis("Сегодня отлично, я очень рад")

    assert result["emotion"] == "happy"
    assert result["feedQuality"] == estimate_feed_quality("Сегодня отлично, я очень рад")


def test_weekly_summary_fallback_is_deterministic() -> None:
    summary = weekly_summary_fallback(
        [
            WeeklyPost(text="Много работал над проектом", emotion="tired"),
            WeeklyPost(text="Поговорил с другом, стало легче", emotion="happy"),
        ],
        "ru",
    )

    assert "За неделю" in summary
    assert "работа" in summary


def test_mood_song_query_is_deterministic_for_same_post() -> None:
    first = query_for_mood("sad", "Сегодня грустно")
    second = query_for_mood("sad", "Сегодня грустно")

    assert first == second
    assert normalize_emotion("unknown") == "neutral"


def test_mood_song_payload_uses_profile_field_names() -> None:
    payload = song_payload(
        MoodSong(
            title="Sweater Weather",
            artist="The Neighbourhood",
            previewUrl="https://example.com/preview.m4a",
            externalUrl="https://example.com/song",
            artworkUrl="https://example.com/art.jpg",
        )
    )

    assert payload["moodSongTitle"] == "Sweater Weather"
    assert payload["moodSongArtist"] == "The Neighbourhood"
    assert payload["moodSongPreviewUrl"].endswith(".m4a")


def test_telegram_daily_due_uses_user_local_hour() -> None:
    user = {
        "telegramDailyNotifyHour": 17,
        "telegramTimezoneOffsetMinutes": -300,
        "telegramQuietHoursEnabled": False,
    }
    now = datetime(2026, 5, 17, 12, 30, tzinfo=timezone.utc)

    assert _daily_due_now(user, now)
    assert _local_day_key(user, now) == "2026-05-17"


def test_telegram_quiet_hours_can_cross_midnight() -> None:
    user = {
        "telegramTimezoneOffsetMinutes": -300,
        "telegramQuietHoursEnabled": True,
        "telegramQuietStartHour": 22,
        "telegramQuietEndHour": 8,
    }

    assert _in_quiet_hours(user, datetime(2026, 5, 17, 18, 0, tzinfo=timezone.utc))
    assert not _in_quiet_hours(user, datetime(2026, 5, 17, 7, 0, tzinfo=timezone.utc))
