from fastapi.testclient import TestClient

from app.main import create_app
from app.services.ai import WeeklyPost, estimate_feed_quality, fallback_analysis, weekly_summary_fallback
from app.services.telegram_webapp import validate_webapp_init_data


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
