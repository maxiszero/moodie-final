from pymongo import ASCENDING, DESCENDING

from .db import get_database


async def ensure_indexes() -> None:
    db = get_database()
    await db.users.create_index([("username", ASCENDING)], unique=True)
    await db.users.create_index([("telegramUserId", ASCENDING)], unique=True, sparse=True)
    await db.users.create_index([("telegramDailyNotify", ASCENDING)])
    await db.users.create_index([("banned", ASCENDING)])
    await db.users.create_index([("createdAt", DESCENDING)])
    await db.posts.create_index([("userId", ASCENDING)])
    await db.posts.create_index([("emotion", ASCENDING)])
    await db.posts.create_index([("hidden", ASCENDING)])
    await db.posts.create_index([("createdAt", DESCENDING)])
    await db.posts.create_index([("likes", DESCENDING), ("createdAt", DESCENDING)])
    await db.posts.create_index([("feedSortScore", DESCENDING)])
    await db.comments.create_index([("postId", ASCENDING), ("createdAt", ASCENDING)])
    await db.dailyanswers.create_index([("userId", ASCENDING), ("dayKey", ASCENDING)], unique=True)
    await db.dailyanswers.create_index([("dayKey", DESCENDING), ("createdAt", DESCENDING)])
