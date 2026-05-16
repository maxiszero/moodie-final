import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]

load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / "backend" / ".env")
load_dotenv(ROOT_DIR / "backend-py" / ".env", override=True)


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    port: int = int(os.getenv("PORT", "8000"))
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/moodie")
    mongodb_db_name: str | None = os.getenv("MONGODB_DB_NAME")
    jwt_secret: str = os.getenv("JWT_SECRET", "")
    jwt_expires_days: int = int(os.getenv("JWT_EXPIRES_DAYS", "30"))
    cors_origins: tuple[str, ...] = tuple(
        _csv(os.getenv("CORS_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173"))
    )
    node_env: str = os.getenv("NODE_ENV", os.getenv("ENV", "development")).lower()
    groq_model: str = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    gemini_model: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    ai_weekly_primary: str = os.getenv("AI_WEEKLY_PRIMARY", "auto").lower()
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_web_app_url: str = os.getenv("TELEGRAM_WEB_APP_URL", "").strip()
    telegram_bot_short_name: str = os.getenv("TELEGRAM_BOT_SHORT_NAME", "Moodie").strip()
    telegram_daily_notify_utc_hour: int = int(os.getenv("TELEGRAM_DAILY_NOTIFY_UTC_HOUR", "8"))
    telegram_enable_polling: bool = os.getenv("TELEGRAM_ENABLE_POLLING", "true").lower() in ("1", "true", "yes")


settings = Settings()
