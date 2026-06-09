"""Remove integration-test users/posts from MongoDB. Run only against the target DB."""

from pymongo import MongoClient

from app.config import settings


def main() -> None:
    client = MongoClient(settings.mongodb_uri)
    db = client.get_default_database(default=settings.mongodb_db_name or "test")

    test_user_filter = {"username": {"$regex": r"^(author|reader|admin|mod|rep|int)_"}}
    test_post_filter = {
        "$or": [
            {"text": {"$regex": "integration marker", "$options": "i"}},
            {"text": {"$regex": r"^report me [a-f0-9]{8}$", "$options": "i"}},
        ]
    }

    users = list(db.users.find(test_user_filter, {"_id": 1, "username": 1}))
    user_ids = [row["_id"] for row in users]

    r_posts_text = db.posts.delete_many(test_post_filter)
    r_posts_users = db.posts.delete_many({"userId": {"$in": user_ids}}) if user_ids else None
    if user_ids:
        db.eveningreviews.delete_many({"userId": {"$in": user_ids}})
        db.dailyanswers.delete_many({"userId": {"$in": user_ids}})
    r_users = db.users.delete_many(test_user_filter)

    deleted_posts = r_posts_text.deleted_count + (r_posts_users.deleted_count if r_posts_users else 0)
    print(f"removed {deleted_posts} posts, {r_users.deleted_count} users ({len(users)} matched)")
    client.close()


if __name__ == "__main__":
    main()
