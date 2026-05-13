from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

from ..db import db_dependency
from ..dependencies import current_user
from ..mongo import mongo_json
from ..security import client_ip, create_token, hash_password, verify_password
from ..services.palette import palette_for_emotion

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
    payload = {
        "_id": str(user["_id"]),
        "username": user.get("username", ""),
        "currentEmotion": user.get("currentEmotion") or "neutral",
        "currentEmoji": user.get("currentEmoji") or "😐",
        "currentColor": user.get("currentColor") or "#9E9E9E",
        "currentColor2": user.get("currentColor2") or "#757575",
        "currentColor3": user.get("currentColor3") or "#616161",
        "preferredLanguage": user.get("preferredLanguage") or "ru",
        "preferredTheme": user.get("preferredTheme") or "light",
        "role": user.get("role") or "user",
    }
    if token is not None:
        payload["token"] = token
    return payload


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
        "color": "#9E9E9E",
        "color2": "#757575",
        "color3": "#616161",
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


@router.get("/me")
async def get_me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    return auth_payload(mongo_json(user))
