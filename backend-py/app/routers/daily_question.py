import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from ..db import db_dependency
from ..dependencies import banned_user_ids, current_user, optional_user
from ..mongo import stringify_mongo
from ..services.daily_question import get_mood_bucket, pick_question, resolve_lang, submit_daily_answer, utc_day_key

router = APIRouter(prefix="/daily-question", tags=["daily-question"])

DAY_KEY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def today_payload(
    day_key: str,
    mood_bucket: str,
    lang: str,
    question: str,
    has_answered: bool,
    my_answer: str | None,
    can_answer: bool,
) -> dict[str, Any]:
    return {
        "dayKey": day_key,
        "moodBucket": mood_bucket,
        "lang": lang,
        "question": question,
        "hasAnswered": has_answered,
        "myAnswer": my_answer,
        "canAnswer": can_answer,
    }


@router.get("/today")
async def get_today(
    lang: str | None = None,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] | None = Depends(optional_user),
) -> dict[str, Any]:
    day_key = utc_day_key()
    resolved_lang = resolve_lang(user, lang)
    if not user:
        mood_bucket = "neutral"
        question = pick_question(day_key, mood_bucket, resolved_lang)
        return today_payload(day_key, mood_bucket, resolved_lang, question, False, None, False)

    existing = await db.dailyanswers.find_one({"userId": user["_id"], "dayKey": day_key})
    if existing:
        return today_payload(
            day_key,
            existing.get("moodBucket") or "neutral",
            existing.get("lang") or resolved_lang,
            existing.get("questionText") or "",
            True,
            existing.get("text") or "",
            True,
        )

    mood_bucket = get_mood_bucket(user.get("currentEmotion"))
    question = pick_question(day_key, mood_bucket, resolved_lang)
    return today_payload(day_key, mood_bucket, resolved_lang, question, False, None, True)


@router.get("/answers")
async def get_anonymous_answers(
    dayKey: str | None = None,
    page: int = Query(1, ge=1),
    limit: int = Query(30, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(db_dependency),
) -> dict[str, Any]:
    day_key = dayKey if isinstance(dayKey, str) and DAY_KEY_RE.match(dayKey) else utc_day_key()
    skip = (page - 1) * limit
    banned_ids = await banned_user_ids(db)
    query: dict[str, Any] = {"dayKey": day_key}
    if banned_ids:
        query["userId"] = {"$nin": banned_ids}

    rows = await (
        db.dailyanswers.find(query, {"text": 1, "createdAt": 1})
        .sort("createdAt", DESCENDING)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.dailyanswers.count_documents(query)
    return {
        "dayKey": day_key,
        "page": page,
        "limit": limit,
        "total": total,
        "answers": [{"text": row.get("text") or "", "createdAt": stringify_mongo(row.get("createdAt"))} for row in rows],
    }


@router.post("/answer", status_code=201)
async def post_answer(
    body: dict[str, Any],
    lang: str | None = None,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    raw = body.get("text") if isinstance(body, dict) else ""
    text = raw.strip() if isinstance(raw, str) else ""
    result = await submit_daily_answer(db, user, text, lang=lang)
    day_key = result["dayKey"]
    existing = await db.dailyanswers.find_one({"userId": user["_id"], "dayKey": day_key})
    if not existing:
        raise HTTPException(status_code=500, detail={"message": "Could not save answer"})
    return today_payload(
        existing.get("dayKey") or day_key,
        existing.get("moodBucket") or "neutral",
        existing.get("lang") or resolve_lang(user, lang),
        existing.get("questionText") or "",
        True,
        result["text"],
        True,
    )
