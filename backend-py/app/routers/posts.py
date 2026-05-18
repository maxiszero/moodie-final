import re
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from ..db import db_dependency
from ..dependencies import banned_user_ids, current_user, optional_user
from ..mongo import mongo_json, object_id, stringify_mongo
from ..realtime import emit_new_post
from ..services.ai import analyze_emotion
from ..services.mood_song import pick_mood_song, song_payload
from ..services.palette import normalize_emotion, palette_for_emotion

router = APIRouter(prefix="/posts", tags=["posts"])

FEED_QUALITY_PENALTY_MS = 3 * 60 * 1000
LINK_RE = re.compile(r"(https?://\S+|www\.\S+)", re.I)
VALID_REACTIONS = {"feel_this", "stay_strong", "hits_hard"}
AUTHOR_FIELDS = {
    "username": 1,
    "currentEmotion": 1,
    "currentEmoji": 1,
    "currentColor": 1,
    "currentColor2": 1,
    "currentColor3": 1,
}


def feed_sort_score(created_at: datetime, feed_quality: int | float | None) -> float:
    quality = min(100, max(0, round(feed_quality if isinstance(feed_quality, (int, float)) else 65)))
    return created_at.timestamp() * 1000 - (100 - quality) * FEED_QUALITY_PENALTY_MS


def projection_without_private() -> dict[str, int]:
    return {"feedQuality": 0, "feedSortScore": 0}


def excluded_author_ids(banned_ids: list[ObjectId], user: dict[str, Any] | None) -> list[ObjectId]:
    excluded = [*banned_ids]
    if user:
        excluded.extend(user.get("blockedUsers") or [])
    return list({str(item): item for item in excluded}.values())


async def following_ids(db: AsyncIOMotorDatabase, user: dict[str, Any] | None) -> set[str]:
    if not user:
        return set()
    fresh = await db.users.find_one({"_id": user["_id"]}, {"following": 1})
    return {str(item) for item in (fresh or {}).get("following", [])}


async def populate_posts(
    db: AsyncIOMotorDatabase,
    posts: list[dict[str, Any]],
    user: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    author_ids = [post.get("userId") for post in posts if isinstance(post.get("userId"), ObjectId)]
    authors = {}
    if author_ids:
        cursor = db.users.find({"_id": {"$in": author_ids}}, AUTHOR_FIELDS)
        async for author in cursor:
            authors[str(author["_id"])] = mongo_json(author)
    following = await following_ids(db, user)
    output = []
    for post in posts:
        raw_author_id = post.get("userId")
        author_id = str(raw_author_id) if raw_author_id is not None else None
        post = mongo_json(post)
        post.pop("feedQuality", None)
        post.pop("feedSortScore", None)
        if author_id and author_id in authors:
            post["userId"] = authors[author_id]
        post["isFollowingAuthor"] = bool(author_id and author_id in following)
        output.append(post)
    return output


def stabilizers_for_emotion(value: str) -> list[str]:
    emotion = normalize_emotion(value)
    if emotion in {"angry", "anxious", "scared", "anxiety"}:
        return ["calmness", "neutral", "loved"]
    if emotion in {"sad", "melancholy", "apathy", "tired"}:
        return ["neutral", "calmness", "loved", "inspiration"]
    return ["neutral", "calmness"]


def interleave(primary: list[dict[str, Any]], stable: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    output = []
    i = 0
    j = 0
    while len(output) < limit and (i < len(primary) or j < len(stable)):
        if i < len(primary):
            output.append(primary[i])
            i += 1
        if len(output) >= limit:
            break
        if i < len(primary):
            output.append(primary[i])
            i += 1
        if len(output) >= limit:
            break
        if j < len(stable):
            output.append(stable[j])
            j += 1
    output.extend(primary[i : i + max(0, limit - len(output))])
    output.extend(stable[j : j + max(0, limit - len(output))])
    return output[:limit]


@router.get("")
@router.get("/")
async def get_posts(
    sort: str = "latest",
    emotion: str | None = None,
    moodMix: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] | None = Depends(optional_user),
) -> list[dict[str, Any]]:
    sort_option = [("likes", DESCENDING), ("feedSortScore", DESCENDING), ("createdAt", DESCENDING)] if sort == "trending" else [("feedSortScore", DESCENDING), ("createdAt", DESCENDING)]
    banned_ids = await banned_user_ids(db)
    excluded = excluded_author_ids(banned_ids, user)
    query: dict[str, Any] = {"hidden": {"$ne": True}}
    if excluded:
        query["userId"] = {"$nin": excluded}
    if emotion:
        query["emotion"] = emotion
    skip = (page - 1) * limit

    can_mood_mix = moodMix.strip() == "1" and user is not None and not emotion
    if not can_mood_mix:
        posts = await db.posts.find(query, projection_without_private()).sort(sort_option).skip(skip).limit(limit).to_list(limit)
        return await populate_posts(db, posts, user)

    user_emotion = normalize_emotion(user.get("currentEmotion") or "neutral")
    stable_emotions = [item for item in stabilizers_for_emotion(user_emotion) if item != user_emotion]
    primary_limit = max(1, round(limit * 0.7))
    stable_limit = max(0, limit - primary_limit)
    primary_query = {**query, "emotion": user_emotion}
    stable_query = {**query, "emotion": {"$in": stable_emotions}}
    primary = await db.posts.find(primary_query, projection_without_private()).sort(sort_option).skip((page - 1) * primary_limit).limit(primary_limit).to_list(primary_limit)
    stable = await db.posts.find(stable_query, projection_without_private()).sort(sort_option).skip((page - 1) * stable_limit).limit(stable_limit).to_list(stable_limit) if stable_limit else []
    return await populate_posts(db, interleave(primary, stable, limit), user)


@router.get("/search")
async def search_posts(
    q: str = "",
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] | None = Depends(optional_user),
) -> list[dict[str, Any]]:
    raw = q.strip()
    if len(raw) < 2:
        return []
    if len(raw) > 64:
        raise HTTPException(status_code=400, detail={"message": "Query too long"})
    banned_ids = await banned_user_ids(db)
    excluded = excluded_author_ids(banned_ids, user)
    query: dict[str, Any] = {"text": {"$regex": re.escape(raw), "$options": "i"}, "hidden": {"$ne": True}}
    if excluded:
        query["userId"] = {"$nin": excluded}
    posts = await db.posts.find(query, projection_without_private()).sort("createdAt", DESCENDING).limit(10).to_list(10)
    return await populate_posts(db, posts, user)


@router.get("/stats/mood")
async def get_mood_stats(db: AsyncIOMotorDatabase = Depends(db_dependency)) -> list[dict[str, Any]]:
    since = datetime.now(timezone.utc) - timedelta(hours=24)
    pipeline = [
        {"$match": {"createdAt": {"$gte": since}, "hidden": {"$ne": True}}},
        {"$group": {"_id": "$emotion", "count": {"$sum": 1}, "emoji": {"$first": "$emoji"}, "color": {"$first": "$color"}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]
    return stringify_mongo(await db.posts.aggregate(pipeline).to_list(5))


async def create_post_from_text(db: AsyncIOMotorDatabase, user: dict[str, Any], text: str) -> dict[str, Any]:
    """Shared create-post logic (HTTP API and Telegram bot)."""
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail={"message": "Please provide text for the post"})
    text = text.strip()
    if len(text) > 228:
        raise HTTPException(status_code=400, detail={"message": "Post text cannot exceed 228 characters"})
    if LINK_RE.search(text):
        raise HTTPException(status_code=400, detail={"message": "Links are not allowed in posts for security reasons"})

    analysis = await analyze_emotion(text)
    palette = palette_for_emotion(analysis.get("emotion"))
    if palette:
        analysis["emotion"] = palette["emotion"]
        analysis["color"] = palette["color"]
        analysis["color2"] = palette["color2"]
        analysis["color3"] = palette["color3"]
    feed_quality = analysis.get("feedQuality") if isinstance(analysis.get("feedQuality"), (int, float)) else 65
    mood_song = song_payload(await pick_mood_song(analysis.get("emotion") or "neutral", text)) or {}
    now = datetime.now(timezone.utc)
    doc = {
        "userId": user["_id"],
        "text": text,
        "emotion": analysis.get("emotion") or "neutral",
        "emoji": analysis.get("emoji") or "😐",
        "intensity": analysis.get("intensity") or 50,
        "color": analysis.get("color") or "#E0E7FF",
        "color2": analysis.get("color2") or "#A5B4FC",
        "color3": analysis.get("color3") or "#6366F1",
        "reasoning": analysis.get("reasoning") or "",
        "tip": analysis.get("tip") or "",
        "reactions": [],
        "likes": 0,
        "likedBy": [],
        "relatable": 0,
        "relatableBy": [],
        "reports": 0,
        "reportedBy": [],
        "hidden": False,
        "feedQuality": feed_quality,
        "feedSortScore": feed_sort_score(now, feed_quality),
        "commentsCount": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    result = await db.posts.insert_one(doc)
    doc["_id"] = result.inserted_id
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "currentEmotion": doc["emotion"],
                "currentEmoji": doc["emoji"],
                "currentColor": doc["color"],
                "currentColor2": doc["color2"],
                "currentColor3": doc["color3"],
                "weeklyAiSummary": "",
                "weeklyAiSummaryAt": None,
                **mood_song,
                "updatedAt": now,
            }
        },
    )
    populated = await populate_posts(db, [doc], user)
    populated[0]["isFollowingAuthor"] = False
    await emit_new_post(populated[0])
    return populated[0]


@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_post(
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    text = body.get("text") if isinstance(body, dict) else None
    if not isinstance(text, str) or not text:
        raise HTTPException(status_code=400, detail={"message": "Please provide text for the post"})
    return await create_post_from_text(db, user, text)


@router.post("/ai/tip")
async def get_ai_tip(
    body: dict[str, Any],
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    _ = user
    text = body.get("text") if isinstance(body, dict) else ""
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail={"message": "Text required"})
    if len(text) > 228:
        raise HTTPException(status_code=400, detail={"message": "Text too long"})
    result = await analyze_emotion(text, tip_only=True)
    return {"tip": result.get("tip") or ""}


@router.post("/{post_id}/like")
async def toggle_like(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    post = await db.posts.find_one({"_id": object_id(post_id), "hidden": {"$ne": True}})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    liked = any(str(item) == str(user["_id"]) for item in post.get("likedBy", []))
    update = {"$pull": {"likedBy": user["_id"]}, "$inc": {"likes": -1}} if liked else {"$addToSet": {"likedBy": user["_id"]}, "$inc": {"likes": 1}}
    await db.posts.update_one({"_id": post["_id"]}, update)
    fresh = await db.posts.find_one({"_id": post["_id"]}, {"likedBy": 1, "likes": 1})
    return {"message": "Like removed" if liked else "Like added", "likes": max(0, fresh.get("likes", 0)), "likedBy": stringify_mongo(fresh.get("likedBy", []))}


@router.post("/{post_id}/reaction")
async def toggle_reaction(
    post_id: str,
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    reaction_type = body.get("reactionType") if isinstance(body, dict) else None
    if reaction_type not in VALID_REACTIONS:
        raise HTTPException(status_code=400, detail={"message": "Invalid reaction type"})
    post = await db.posts.find_one({"_id": object_id(post_id), "hidden": {"$ne": True}}, {"reactions": 1})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    reactions = post.get("reactions") or []
    exists = any(str(r.get("userId")) == str(user["_id"]) and r.get("type") == reaction_type for r in reactions)
    if exists:
        reactions = [r for r in reactions if not (str(r.get("userId")) == str(user["_id"]) and r.get("type") == reaction_type)]
    else:
        reactions.append({"type": reaction_type, "userId": user["_id"]})
    await db.posts.update_one({"_id": post["_id"]}, {"$set": {"reactions": reactions, "updatedAt": datetime.now(timezone.utc)}})
    return {"message": "Reaction removed" if exists else "Reaction added", "reactions": stringify_mongo(reactions)}


@router.post("/{post_id}/relatable")
async def toggle_relatable(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    post = await db.posts.find_one({"_id": object_id(post_id), "hidden": {"$ne": True}}, {"relatableBy": 1, "relatable": 1})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    active = any(str(item) == str(user["_id"]) for item in post.get("relatableBy", []))
    update = {"$pull": {"relatableBy": user["_id"]}, "$inc": {"relatable": -1}} if active else {"$addToSet": {"relatableBy": user["_id"]}, "$inc": {"relatable": 1}}
    await db.posts.update_one({"_id": post["_id"]}, update)
    fresh = await db.posts.find_one({"_id": post["_id"]}, {"relatableBy": 1, "relatable": 1})
    return {"relatable": max(0, fresh.get("relatable", 0)), "relatableBy": stringify_mongo(fresh.get("relatableBy", []))}


@router.post("/{post_id}/report")
async def report_post(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    post = await db.posts.find_one({"_id": object_id(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    if any(str(item) == str(user["_id"]) for item in post.get("reportedBy", [])):
        raise HTTPException(status_code=400, detail={"message": "Already reported"})
    reports = int(post.get("reports", 0)) + 1
    hidden = reports >= 5
    await db.posts.update_one({"_id": post["_id"]}, {"$addToSet": {"reportedBy": user["_id"]}, "$set": {"reports": reports, "hidden": hidden, "updatedAt": datetime.now(timezone.utc)}})
    return {"message": "Post reported", "reports": reports, "hidden": hidden}


@router.delete("/{post_id}")
async def delete_post(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    post = await db.posts.find_one({"_id": object_id(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    owner = str(post.get("userId")) == str(user["_id"])
    if not owner and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail={"message": "You can only delete your own posts"})
    await db.comments.delete_many({"postId": post["_id"]})
    await db.posts.delete_one({"_id": post["_id"]})
    return {"message": "Post deleted", "id": post_id}


@router.get("/{post_id}/comments")
async def get_comments(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] | None = Depends(optional_user),
) -> list[dict[str, Any]]:
    post = await db.posts.find_one({"_id": object_id(post_id), "hidden": {"$ne": True}}, {"_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    banned_ids = await banned_user_ids(db)
    excluded = excluded_author_ids(banned_ids, user)
    query: dict[str, Any] = {"postId": post["_id"], "hidden": {"$ne": True}}
    if excluded:
        query["userId"] = {"$nin": excluded}
    comments = await db.comments.find(query).sort("createdAt", ASCENDING).limit(200).to_list(200)
    author_ids = [c.get("userId") for c in comments if isinstance(c.get("userId"), ObjectId)]
    authors = {}
    if author_ids:
        async for author in db.users.find({"_id": {"$in": author_ids}}, AUTHOR_FIELDS):
            authors[str(author["_id"])] = mongo_json(author)
    output = []
    for comment in comments:
        author_id = str(comment.get("userId"))
        item = mongo_json(comment)
        if author_id in authors:
            item["userId"] = authors[author_id]
        output.append(item)
    return output


@router.post("/{post_id}/comments", status_code=201)
async def add_comment(
    post_id: str,
    body: dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, Any]:
    post = await db.posts.find_one({"_id": object_id(post_id), "hidden": {"$ne": True}}, {"_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    text = body.get("text") if isinstance(body, dict) else ""
    text = text.strip() if isinstance(text, str) else ""
    if not text:
        raise HTTPException(status_code=400, detail={"message": "Comment text is required"})
    if len(text) > 500:
        raise HTTPException(status_code=400, detail={"message": "Comment is too long"})
    if LINK_RE.search(text):
        raise HTTPException(status_code=400, detail={"message": "Links are not allowed in comments"})
    now = datetime.now(timezone.utc)
    doc = {"postId": post["_id"], "userId": user["_id"], "text": text, "hidden": False, "createdAt": now, "updatedAt": now}
    result = await db.comments.insert_one(doc)
    doc["_id"] = result.inserted_id
    await db.posts.update_one({"_id": post["_id"]}, {"$inc": {"commentsCount": 1}})
    doc["userId"] = mongo_json(await db.users.find_one({"_id": user["_id"]}, AUTHOR_FIELDS))
    return mongo_json(doc)


@router.delete("/{post_id}/comments/{comment_id}")
async def delete_comment(
    post_id: str,
    comment_id: str,
    db: AsyncIOMotorDatabase = Depends(db_dependency),
    user: dict[str, Any] = Depends(current_user),
) -> dict[str, str]:
    post = await db.posts.find_one({"_id": object_id(post_id)}, {"_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail={"message": "Post not found"})
    comment = await db.comments.find_one({"_id": object_id(comment_id, "comment id"), "postId": post["_id"]})
    if not comment:
        raise HTTPException(status_code=404, detail={"message": "Comment not found"})
    own = str(comment.get("userId")) == str(user["_id"])
    if not own and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail={"message": "You can only delete your own comments"})
    await db.comments.delete_one({"_id": comment["_id"]})
    await db.posts.update_one({"_id": post["_id"]}, {"$inc": {"commentsCount": -1}})
    await db.posts.update_one({"_id": post["_id"], "commentsCount": {"$lt": 0}}, {"$set": {"commentsCount": 0}})
    return {"message": "Comment deleted", "id": comment_id}
