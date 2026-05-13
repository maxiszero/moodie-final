from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from ..db import db_dependency
from ..dependencies import current_admin
from ..mongo import mongo_json, object_id, stringify_mongo

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_POST_AUTHOR_FIELDS = {
    "username": 1,
    "currentEmotion": 1,
    "banned": 1,
}


@router.get("/users")
async def get_admin_users(
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    admin: dict[str, Any] = Depends(current_admin),
) -> list[dict[str, Any]]:
    _ = admin
    users = await (
        db.users.find({}, {"password": 0})
        .sort("createdAt", DESCENDING)
        .limit(500)
        .to_list(500)
    )
    return stringify_mongo(users)


@router.get("/posts")
async def get_admin_posts(
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    admin: dict[str, Any] = Depends(current_admin),
) -> list[dict[str, Any]]:
    _ = admin
    posts = await (
        db.posts.find({}, {"feedQuality": 0, "feedSortScore": 0})
        .sort("createdAt", DESCENDING)
        .limit(300)
        .to_list(300)
    )
    author_ids = [post.get("userId") for post in posts if post.get("userId")]
    authors = {}
    if author_ids:
        async for author in db.users.find({"_id": {"$in": author_ids}}, ADMIN_POST_AUTHOR_FIELDS):
            authors[str(author["_id"])] = mongo_json(author)

    output = []
    for post in posts:
        author_id = str(post.get("userId")) if post.get("userId") else ""
        item = mongo_json(post)
        if author_id in authors:
            item["userId"] = authors[author_id]
        output.append(item)
    return output


@router.patch("/users/{user_id}/ban")
async def set_user_ban(
    user_id: str,
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    admin: dict[str, Any] = Depends(current_admin),
) -> dict[str, Any]:
    banned = body.get("banned") if isinstance(body, dict) else None
    if not isinstance(banned, bool):
        raise HTTPException(status_code=400, detail={"message": 'Field "banned" (boolean) is required'})

    target = await db.users.find_one({"_id": object_id(user_id, "user id")})
    if not target:
        raise HTTPException(status_code=404, detail={"message": "User not found"})
    if str(target["_id"]) == str(admin["_id"]):
        raise HTTPException(status_code=400, detail={"message": "Cannot ban yourself"})
    if target.get("role") == "admin":
        raise HTTPException(status_code=400, detail={"message": "Cannot ban an administrator"})

    await db.users.update_one(
        {"_id": target["_id"]},
        {"$set": {"banned": banned, "updatedAt": datetime.now(timezone.utc)}},
    )
    return {"_id": str(target["_id"]), "username": target.get("username", ""), "banned": banned}
