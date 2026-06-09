import uuid

from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.config import settings


def register_user(client: TestClient, prefix: str = "int") -> tuple[str, str, dict[str, str]]:
    suffix = uuid.uuid4().hex[:10]
    username = f"{prefix}_{suffix}"
    password = "TestPass1!"
    response = client.post(
        "/api/auth/register",
        json={"username": username, "password": password, "onboardingMood": "neutral"},
    )
    assert response.status_code == 201, response.text
    token = response.json().get("token")
    assert token
    return username, token, {"Authorization": f"Bearer {token}"}


def promote_to_admin(username: str) -> None:
    mongo = MongoClient(settings.mongodb_uri)
    db = mongo.get_default_database(default=settings.mongodb_db_name or "test")
    result = db.users.update_one({"username": username}, {"$set": {"role": "admin"}})
    assert result.matched_count == 1, f"user {username} not found for admin promotion"
    mongo.close()


def user_id(username: str) -> str:
    mongo = MongoClient(settings.mongodb_uri)
    db = mongo.get_default_database(default=settings.mongodb_db_name or "test")
    doc = db.users.find_one({"username": username}, {"_id": 1})
    mongo.close()
    assert doc and doc.get("_id"), f"user {username} not found"
    return str(doc["_id"])


def set_user_banned(username: str, banned: bool = True) -> None:
    mongo = MongoClient(settings.mongodb_uri)
    db = mongo.get_default_database(default=settings.mongodb_db_name or "test")
    result = db.users.update_one({"username": username}, {"$set": {"banned": banned}})
    assert result.matched_count == 1, f"user {username} not found for ban"
    mongo.close()
