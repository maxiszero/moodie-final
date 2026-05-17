import re
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from ..db import db_dependency
from ..dependencies import current_user, optional_user
from ..mongo import mongo_json, stringify_mongo
from ..security import hash_password, verify_password
from ..services.ai import WeeklyPost, weekly_summary_fallback
from .posts import populate_posts, projection_without_private

router = APIRouter(prefix="/users", tags=["users"])

PUBLIC_USER_FIELDS = {
    "username": 1,
    "currentEmotion": 1,
    "currentEmoji": 1,
    "currentColor": 1,
    "currentColor2": 1,
    "currentColor3": 1,
    "moodSongTitle": 1,
    "moodSongArtist": 1,
    "moodSongPreviewUrl": 1,
    "moodSongExternalUrl": 1,
    "moodSongArtworkUrl": 1,
    "moodSongSource": 1,
    "createdAt": 1,
}
WEEKLY_SUMMARY_CACHE_MS = 12 * 60 * 60 * 1000
WEEK_MS = 7 * 24 * 60 * 60


def public_user(user: dict[str, Any] | None) -> dict[str, Any] | None:
    if not user:
        return None
    return mongo_json(
        {
            "_id": user["_id"],
            "username": user.get("username", ""),
            "currentEmotion": user.get("currentEmotion") or "neutral",
            "currentEmoji": user.get("currentEmoji") or "😐",
            "currentColor": user.get("currentColor") or "#9E9E9E",
            "currentColor2": user.get("currentColor2") or "#757575",
            "currentColor3": user.get("currentColor3") or "#616161",
            "moodSongTitle": user.get("moodSongTitle") or "",
            "moodSongArtist": user.get("moodSongArtist") or "",
            "moodSongPreviewUrl": user.get("moodSongPreviewUrl") or "",
            "moodSongExternalUrl": user.get("moodSongExternalUrl") or "",
            "moodSongArtworkUrl": user.get("moodSongArtworkUrl") or "",
            "moodSongSource": user.get("moodSongSource") or "",
            "createdAt": user.get("createdAt"),
        }
    )


def can_view_user(target: dict[str, Any], viewer: dict[str, Any] | None) -> bool:
    if not target.get("banned"):
        return True
    if not viewer:
        return False
    return str(target["_id"]) == str(viewer["_id"]) or viewer.get("role") == "admin"


def validate_new_password(password: str) -> str | None:
    if not password:
        return "Password is required"
    if len(password) < 6:
        return "Password must be at least 6 characters"
    if len(password) > 72:
        return "Password is too long"
    return None


async def resolve_weekly_ai_summary(db: AsyncIOMotorDatabase, user: dict[str, Any]) -> str:
    week_ago = datetime.now(timezone.utc) - timedelta(seconds=WEEK_MS)
    week_posts = await (
        db.posts.find(
            {"userId": user["_id"], "createdAt": {"$gte": week_ago}},
            {"text": 1, "emotion": 1, "emoji": 1, "createdAt": 1},
        )
        .sort("createdAt", DESCENDING)
        .limit(80)
        .to_list(80)
    )
    if not week_posts:
        return ""

    cached_at = user.get("weeklyAiSummaryAt")
    cached_at_ms = cached_at.timestamp() * 1000 if isinstance(cached_at, datetime) else 0
    cached = user.get("weeklyAiSummary") if isinstance(user.get("weeklyAiSummary"), str) else ""
    if cached.strip() and cached_at_ms and datetime.now(timezone.utc).timestamp() * 1000 - cached_at_ms < WEEKLY_SUMMARY_CACHE_MS:
        return cached.strip()

    lang = "en" if user.get("preferredLanguage") == "en" else "ru"
    summary = weekly_summary_fallback(
        [
            WeeklyPost(
                text=post.get("text") or "",
                emotion=post.get("emotion"),
                emoji=post.get("emoji"),
                createdAt=post.get("createdAt"),
            )
            for post in week_posts
        ],
        lang,
    )
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"weeklyAiSummary": summary, "weeklyAiSummaryAt": datetime.now(timezone.utc)}},
    )
    return summary


@router.patch("/me/password")
async def update_password(
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    current_password = body.get("currentPassword") if isinstance(body, dict) else ""
    new_password = body.get("newPassword") if isinstance(body, dict) else ""
    current_password = current_password if isinstance(current_password, str) else ""
    new_password = new_password if isinstance(new_password, str) else ""
    error = validate_new_password(new_password)
    if error:
        raise HTTPException(status_code=400, detail={"message": error})

    full_user = await db.users.find_one({"_id": user["_id"]})
    if not full_user:
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    if not verify_password(current_password, full_user.get("password", "")):
        raise HTTPException(status_code=400, detail={"message": "Current password is incorrect"})

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(new_password), "updatedAt": datetime.now(timezone.utc)}},
    )
    return {"message": "Password updated"}


@router.patch("/me/settings")
async def update_settings(
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    updates: dict[str, Any] = {}
    if isinstance(body, dict) and body.get("preferredLanguage") in {"ru", "en"}:
        updates["preferredLanguage"] = body["preferredLanguage"]
    if isinstance(body, dict) and body.get("preferredTheme") in {"light", "dark"}:
        updates["preferredTheme"] = body["preferredTheme"]
    if not updates:
        raise HTTPException(status_code=400, detail={"message": "No valid settings provided"})
    if updates.get("preferredLanguage") and user.get("preferredLanguage") != updates["preferredLanguage"]:
        updates["weeklyAiSummary"] = ""
        updates["weeklyAiSummaryAt"] = None
    updates["updatedAt"] = datetime.now(timezone.utc)
    await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    fresh = await db.users.find_one({"_id": user["_id"]}, {"preferredLanguage": 1, "preferredTheme": 1})
    return {
        "preferredLanguage": fresh.get("preferredLanguage", "ru"),
        "preferredTheme": fresh.get("preferredTheme", "light"),
    }


@router.get("/search")
async def search_users(q: str = "", db: AsyncIOMotorDatabase = Depends(db_dependency)) -> list[dict[str, Any]]:
    raw = q.strip()
    if len(raw) < 2:
        return []
    if len(raw) > 32:
        raise HTTPException(status_code=400, detail={"message": "Query too long"})
    users = await (
        db.users.find(
            {"username": {"$regex": re.escape(raw), "$options": "i"}, "banned": {"$ne": True}},
            PUBLIC_USER_FIELDS,
        )
        .sort("username", ASCENDING)
        .limit(12)
        .to_list(12)
    )
    return stringify_mongo(users)


@router.get("/{username}/followers")
async def get_followers(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    viewer: dict[str, Any] | None = Depends(optional_user),
) -> list[dict[str, Any]]:
    target = await db.users.find_one({"username": username}, {"_id": 1, "banned": 1, "username": 1, "role": 1})
    if not target or not can_view_user(target, viewer):
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    followers = await (
        db.users.find({"following": target["_id"]}, PUBLIC_USER_FIELDS)
        .sort("username", ASCENDING)
        .to_list(None)
    )
    return stringify_mongo(followers)


@router.get("/{username}/following")
async def get_following(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    viewer: dict[str, Any] | None = Depends(optional_user),
) -> list[dict[str, Any]]:
    target = await db.users.find_one({"username": username}, {"following": 1, "banned": 1, "username": 1, "role": 1})
    if not target or not can_view_user(target, viewer):
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    following_ids = target.get("following") or []
    if not following_ids:
        return []
    users = await db.users.find({"_id": {"$in": following_ids}}, PUBLIC_USER_FIELDS).to_list(None)
    by_id = {str(user["_id"]): user for user in users}
    ordered = [by_id[str(user_id)] for user_id in following_ids if str(user_id) in by_id]
    return stringify_mongo(ordered)


@router.post("/{username}/follow")
async def follow_user(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    target = await db.users.find_one({"username": username})
    if not target:
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    if target.get("banned"):
        raise HTTPException(status_code=400, detail={"message": "Cannot follow this user"})
    if str(target["_id"]) == str(user["_id"]):
        raise HTTPException(status_code=400, detail={"message": "Cannot follow yourself"})

    already = any(str(item) == str(target["_id"]) for item in user.get("following", []))
    if already:
        followers_count = await db.users.count_documents({"following": target["_id"]})
        return {"message": "Already following", "isFollowing": True, "followersCount": followers_count}
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$addToSet": {"following": target["_id"]}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )
    followers_count = await db.users.count_documents({"following": target["_id"]})
    return {"message": "Followed", "isFollowing": True, "followersCount": followers_count}


@router.delete("/{username}/follow")
async def unfollow_user(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    target = await db.users.find_one({"username": username}, {"_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$pull": {"following": target["_id"]}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
    )
    followers_count = await db.users.count_documents({"following": target["_id"]})
    return {"message": "Unfollowed", "isFollowing": False, "followersCount": followers_count}


@router.post("/{username}/block")
async def block_user(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    target = await db.users.find_one({"username": username}, {"_id": 1})
    if not target:
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    if str(target["_id"]) == str(user["_id"]):
        raise HTTPException(status_code=400, detail={"message": "Cannot block yourself"})
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$addToSet": {"blockedUsers": target["_id"]},
            "$pull": {"following": target["_id"]},
            "$set": {"updatedAt": datetime.now(timezone.utc)},
        },
    )
    return {"message": "User blocked"}


@router.get("/{username}/heatmap")
async def get_mood_heatmap(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> list[dict[str, Any]]:
    user = await db.users.find_one({"username": username}, {"_id": 1})
    if not user:
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    one_year_ago = datetime.now(timezone.utc) - timedelta(days=365)
    pipeline = [
        {"$match": {"userId": user["_id"], "createdAt": {"$gte": one_year_ago}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}},
                "dominantColor": {"$first": "$color"},
                "emotions": {"$push": {"emotion": "$emotion", "emoji": "$emoji", "color": "$color"}},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    return stringify_mongo(await db.posts.aggregate(pipeline).to_list(None))


@router.get("/{username}")
async def get_user_by_username(
    username: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    viewer: dict[str, Any] | None = Depends(optional_user),
) -> dict[str, Any]:
    target = await db.users.find_one({"username": username}, {"password": 0})
    if not target or not can_view_user(target, viewer):
        raise HTTPException(status_code=404, detail={"message": "User not found"})

    posts = await (
        db.posts.find({"userId": target["_id"]}, projection_without_private())
        .sort("createdAt", DESCENDING)
        .to_list(None)
    )
    populated_posts = await populate_posts(db, posts, viewer)
    likes_agg = await db.posts.aggregate(
        [{"$match": {"userId": target["_id"]}}, {"$group": {"_id": None, "total": {"$sum": "$likes"}}}]
    ).to_list(1)
    followers_count = await db.users.count_documents({"following": target["_id"]})
    following_count = len(target.get("following") or [])
    viewer_following = {str(item) for item in (viewer or {}).get("following", [])}
    is_following = bool(viewer and str(target["_id"]) != str(viewer["_id"]) and str(target["_id"]) in viewer_following)
    summary = await resolve_weekly_ai_summary(db, target)

    user_payload = public_user(target)
    user_payload["weeklyAiSummary"] = summary or ""
    return {
        "user": user_payload,
        "posts": populated_posts,
        "followersCount": followers_count,
        "followingCount": following_count,
        "totalLikesReceived": likes_agg[0]["total"] if likes_agg else 0,
        "isFollowing": is_following,
    }
