from typing import Any

from bson import ObjectId
from fastapi import Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorDatabase

from .db import db_dependency
from .mongo import object_id
from .security import token_user_id


async def banned_user_ids(db: AsyncIOMotorDatabase) -> list[ObjectId]:
    return await db.users.distinct("_id", {"banned": True})


async def optional_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> dict[str, Any] | None:
    try:
        user_id = token_user_id(request)
    except HTTPException:
        return None
    if not user_id:
        return None
    user = await db.users.find_one({"_id": object_id(user_id, "token id")}, {"password": 0})
    if not user or user.get("banned"):
        return None
    return user


async def current_user(
    request: Request,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> dict[str, Any]:
    user_id = token_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail={"message": "Not authorized, no token"})
    user = await db.users.find_one({"_id": object_id(user_id, "token id")}, {"password": 0})
    if not user:
        raise HTTPException(status_code=401, detail={"message": "User not found"})
    if user.get("banned"):
        raise HTTPException(status_code=403, detail={"message": "Account banned"})
    return user


async def current_admin(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail={"message": "Admin access required"})
    return user
