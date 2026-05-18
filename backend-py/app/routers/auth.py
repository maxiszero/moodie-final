from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..db import db_dependency
from ..dependencies import current_user
from ..mongo import mongo_json
from ..security import client_ip, create_token, hash_password, verify_password
from ..services.palette import palette_for_emotion
from ..services.telegram_webapp import validate_webapp_init_data

router = APIRouter(prefix="/auth", tags=["auth"])


class AuthRequest(BaseModel):
    username: str = ""
    password: str = ""
    onboardingMood: str = ""
    onboardingEmoji: str = ""


def normalize_username(value: str | None) -> str:
    return value.strip() if isinstance(value, str) else ""


def normalize_password(value: str | None) -> str:
    return value if isinstance(value, str) else ""


def validate_username(username: str) -> str | None:
    if not username:
        return "Please add all fields"
    if len(username) < 3 or len(username) > 24:
        return "Username must be 3-24 characters"
    if not all(ch.isalnum() or ch in "_." for ch in username):
        return "Username contains invalid characters"
    return None


def validate_password(password: str) -> str | None:
    if not password:
        return "Please add all fields"
    if len(password) < 6:
        return "Password must be at least 6 characters"
    if len(password) > 72:
        return "Password is too long"
    return None


def auth_payload(user: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    tg_id = user.get("telegramUserId")
    payload = {
        "_id": str(user["_id"]),
        "username": user.get("username", ""),
        "currentEmotion": user.get("currentEmotion") or "neutral",
        "currentEmoji": user.get("currentEmoji") or "😐",
        "currentColor": user.get("currentColor") or "#E0E7FF",
        "currentColor2": user.get("currentColor2") or "#A5B4FC",
        "currentColor3": user.get("currentColor3") or "#6366F1",
        "preferredLanguage": user.get("preferredLanguage") or "ru",
        "preferredTheme": user.get("preferredTheme") or "light",
        "role": user.get("role") or "user",
        "telegramLinked": tg_id is not None,
    }
    if token is not None:
        payload["token"] = token
    return payload


class TelegramLinkBody(BaseModel):
    initData: str = ""


@router.post("/register", status_code=201)
async def register_user(
    payload: AuthRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> dict[str, Any]:
    username = normalize_username(payload.username)
    password = normalize_password(payload.password)
    username_error = validate_username(username)
    if username_error:
        raise HTTPException(status_code=400, detail={"message": username_error})
    password_error = validate_password(password)
    if password_error:
        raise HTTPException(status_code=400, detail={"message": password_error})

    existing = await db.users.find_one({"username": username}, {"_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail={"message": "User already exists"})

    user_count = await db.users.count_documents({})
    allow_first_admin = str(__import__("os").getenv("ALLOW_FIRST_ADMIN", "")).lower() == "true"
    palette = palette_for_emotion(payload.onboardingMood or "neutral") or {
        "emotion": "neutral",
        "color": "#E0E7FF",
        "color2": "#A5B4FC",
        "color3": "#6366F1",
    }
    now = datetime.now(timezone.utc)
    doc = {
        "username": username,
        "password": hash_password(password),
        "currentEmotion": palette["emotion"],
        "currentEmoji": payload.onboardingEmoji or ("😢" if palette["emotion"] == "sad" else "😐"),
        "currentColor": palette["color"],
        "currentColor2": palette["color2"],
        "currentColor3": palette["color3"],
        "weeklyAiSummary": "",
        "weeklyAiSummaryAt": None,
        "blockedUsers": [],
        "following": [],
        "preferredLanguage": "ru",
        "preferredTheme": "light",
        "role": "admin" if allow_first_admin and user_count == 0 else "user",
        "banned": False,
        "registrationIp": client_ip(request),
        "lastIp": client_ip(request),
        "createdAt": now,
        "updatedAt": now,
    }
    try:
        result = await db.users.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail={"message": "User already exists"}) from None
    doc["_id"] = result.inserted_id
    return auth_payload(doc, create_token(result.inserted_id))


@router.post("/login")
async def login_user(
    payload: AuthRequest,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> dict[str, Any]:
    username = normalize_username(payload.username)
    password = normalize_password(payload.password)
    username_error = validate_username(username)
    if username_error:
        raise HTTPException(status_code=400, detail={"message": username_error})
    password_error = validate_password(password)
    if password_error:
        raise HTTPException(status_code=400, detail={"message": password_error})

    user = await db.users.find_one({"username": username})
    if user and user.get("banned"):
        raise HTTPException(status_code=403, detail={"message": "Account banned"})
    if not user or not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=401, detail={"message": "Invalid credentials"})

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastIp": client_ip(request), "updatedAt": datetime.now(timezone.utc)}},
    )
    user["lastIp"] = client_ip(request)
    return auth_payload(user, create_token(user["_id"]))


@router.post("/telegram/webapp-login")
async def telegram_webapp_login(
    body: TelegramLinkBody,
    request: Request,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> dict[str, Any]:
    if not settings.telegram_bot_token.strip():
        raise HTTPException(status_code=503, detail={"message": "Telegram login is not configured"})
    init_data = body.initData.strip() if body.initData else ""
    if not init_data:
        raise HTTPException(status_code=400, detail={"message": "initData is required"})
    try:
        tg = validate_webapp_init_data(init_data, settings.telegram_bot_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"message": str(e)}) from e

    tid = int(tg["telegram_user_id"])
    user = await db.users.find_one({"telegramUserId": tid})
    if not user:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Telegram is not linked to a Moodie account. Register with username and password, then link Telegram in Settings.",
            },
        )
    if user.get("banned"):
        raise HTTPException(status_code=403, detail={"message": "Account banned"})

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"lastIp": client_ip(request), "updatedAt": datetime.now(timezone.utc)}},
    )
    user["lastIp"] = client_ip(request)
    return auth_payload(mongo_json(user), create_token(user["_id"]))


@router.get("/me")
async def get_me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return auth_payload(mongo_json(user))


@router.post("/telegram/link")
async def link_telegram(
    body: TelegramLinkBody,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    if not settings.telegram_bot_token.strip():
        raise HTTPException(status_code=503, detail={"message": "Telegram linking is not configured"})
    init_data = body.initData.strip() if body.initData else ""
    if not init_data:
        raise HTTPException(status_code=400, detail={"message": "initData is required"})
    try:
        tg = validate_webapp_init_data(init_data, settings.telegram_bot_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"message": str(e)}) from e

    tid = int(tg["telegram_user_id"])
    tname = tg.get("telegram_username") or ""

    existing_owner = await db.users.find_one({"telegramUserId": tid}, {"_id": 1})
    if existing_owner and existing_owner["_id"] != user["_id"]:
        raise HTTPException(
            status_code=409,
            detail={"message": "This Telegram account is already linked to another user"},
        )

    my_id = user["_id"]
    my_tg = user.get("telegramUserId")
    if my_tg is not None and int(my_tg) != tid:
        raise HTTPException(
            status_code=409,
            detail={"message": "This Moodie account is already linked to another Telegram account. Unlink first."},
        )

    if my_tg is not None and int(my_tg) == tid:
        await db.users.update_one(
            {"_id": my_id},
            {
                "$set": {
                    "telegramChatId": tid,
                    "telegramUsername": tname,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
        fresh = await db.users.find_one({"_id": my_id})
        return auth_payload(mongo_json(fresh))

    try:
        await db.users.update_one(
            {"_id": my_id},
            {
                "$set": {
                    "telegramUserId": tid,
                    "telegramUsername": tname,
                    "telegramChatId": tid,
                    "updatedAt": datetime.now(timezone.utc),
                }
            },
        )
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail={"message": "This Telegram account is already linked to another user"},
        ) from None

    fresh = await db.users.find_one({"_id": my_id})
    return auth_payload(mongo_json(fresh))


@router.delete("/telegram/unlink")
async def unlink_telegram(
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$unset": {
                "telegramUserId": "",
                "telegramUsername": "",
                "telegramChatId": "",
                "telegramDailyNotify": "",
                "telegramActivityNotify": "",
                "telegramDailyNotifyHour": "",
                "telegramEveningNotify": "",
                "telegramEveningNotifyHour": "",
                "telegramTimezoneOffsetMinutes": "",
                "telegramQuietHoursEnabled": "",
                "telegramQuietStartHour": "",
                "telegramQuietEndHour": "",
                "lastTelegramActivityNotifyAt": "",
                "lastTelegramActivityNotifyType": "",
                "lastDailyNotifyDayKey": "",
            },
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    fresh = await db.users.find_one({"_id": user["_id"]})
    return auth_payload(mongo_json(fresh))
