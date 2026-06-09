from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from ..db import db_dependency
from ..dependencies import current_user
from ..mongo import stringify_mongo
from ..services.evening_review import (
    VALID_CHOICES,
    evening_choice_label,
    get_today_review,
    save_evening_review,
    user_day_key,
)

router = APIRouter(prefix="/evening-review", tags=["evening-review"])


@router.get("/today")
async def evening_today(
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    day_key = user_day_key(user)
    lang = "en" if user.get("preferredLanguage") == "en" else "ru"
    existing = await get_today_review(db, user["_id"], day_key)
    return {
        "dayKey": day_key,
        "hasAnswered": bool(existing),
        "choice": existing.get("choice") if existing else None,
        "choiceLabel": evening_choice_label(existing["choice"], lang) if existing and existing.get("choice") else None,
        "canAnswer": True,
    }


@router.post("/answer")
async def evening_answer(
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    choice = body.get("choice") if isinstance(body, dict) else None
    if choice not in VALID_CHOICES:
        raise HTTPException(status_code=400, detail={"message": "Invalid choice"})
    day_key = user_day_key(user)
    ok = await save_evening_review(db, user["_id"], day_key, str(choice))
    if not ok:
        raise HTTPException(status_code=500, detail={"message": "Could not save review"})
    lang = "en" if user.get("preferredLanguage") == "en" else "ru"
    return {
        "dayKey": day_key,
        "hasAnswered": True,
        "choice": choice,
        "choiceLabel": evening_choice_label(str(choice), lang),
        "canAnswer": True,
    }


@router.get("/me/history")
async def evening_history(
    limit: int = Query(7, ge=1, le=30),
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    lang = "en" if user.get("preferredLanguage") == "en" else "ru"
    rows = await (
        db.eveningreviews.find({"userId": user["_id"]}, {"dayKey": 1, "choice": 1, "createdAt": 1, "updatedAt": 1})
        .sort("dayKey", DESCENDING)
        .limit(limit)
        .to_list(limit)
    )
    return {
        "reviews": [
            {
                "dayKey": row.get("dayKey"),
                "choice": row.get("choice"),
                "choiceLabel": evening_choice_label(str(row.get("choice") or ""), lang),
                "createdAt": stringify_mongo(row.get("createdAt")),
                "updatedAt": stringify_mongo(row.get("updatedAt")),
            }
            for row in rows
        ]
    }
