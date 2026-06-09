import uuid

from fastapi.testclient import TestClient

from app.services.post_search import post_text_search_filter
from support import promote_to_admin, register_user, set_user_banned, user_id


def test_post_text_search_filter_uses_text_index_for_multi_word() -> None:
    query = post_text_search_filter("hello world")
    assert "$text" in query
    assert query["$text"]["$search"] == "hello world"


def test_post_text_search_filter_uses_regex_for_single_token() -> None:
    query = post_text_search_filter("hello")
    assert "text" in query
    assert "$regex" in query["text"]


def test_auth_register_login_and_evening_review(client: TestClient) -> None:
    _, _, headers = register_user(client)

    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200

    today = client.get("/api/evening-review/today", headers=headers)
    assert today.status_code == 200
    assert today.json().get("hasAnswered") is False

    answer = client.post("/api/evening-review/answer", headers=headers, json={"choice": "ok"})
    assert answer.status_code == 200
    assert answer.json().get("hasAnswered") is True

    history = client.get("/api/evening-review/me/history?limit=3", headers=headers)
    assert history.status_code == 200
    assert len(history.json().get("reviews") or []) >= 1


def test_posts_create_search_and_follow(client: TestClient) -> None:
    author_name, _, author_headers = register_user(client, prefix="author")
    reader_name, _, reader_headers = register_user(client, prefix="reader")

    marker = uuid.uuid4().hex[:8]
    post_text = f"integration marker {marker} moodie"

    created = client.post("/api/posts", headers=author_headers, json={"text": post_text})
    assert created.status_code == 201, created.text
    post_id = created.json().get("_id")
    assert post_id

    search = client.get(f"/api/posts/search?q={marker}", headers=reader_headers)
    assert search.status_code == 200
    ids = [item.get("_id") for item in search.json()]
    assert post_id in ids

    follow = client.post(f"/api/users/{author_name}/follow", headers=reader_headers)
    assert follow.status_code == 200

    profile = client.get(f"/api/users/{author_name}", headers=reader_headers)
    assert profile.status_code == 200
    assert profile.json().get("isFollowing") is True


def test_admin_reported_posts_queue(client: TestClient) -> None:
    admin_name, _, admin_headers = register_user(client, prefix="admin")
    author_name, _, author_headers = register_user(client, prefix="mod")
    reporter_name, _, reporter_headers = register_user(client, prefix="rep")
    promote_to_admin(admin_name)

    marker = uuid.uuid4().hex[:8]
    created = client.post(
        "/api/posts",
        headers=author_headers,
        json={"text": f"report me {marker}"},
    )
    assert created.status_code == 201
    post_id = created.json()["_id"]

    denied = client.get("/api/admin/reported-posts", headers=author_headers)
    assert denied.status_code == 403

    report = client.post(f"/api/posts/{post_id}/report", headers=reporter_headers)
    assert report.status_code == 200

    queue = client.get("/api/admin/reported-posts", headers=admin_headers)
    assert queue.status_code == 200
    queued_ids = [item.get("_id") for item in queue.json()]
    assert post_id in queued_ids

    hide = client.patch(
        f"/api/admin/posts/{post_id}/hidden",
        headers=admin_headers,
        json={"hidden": True},
    )
    assert hide.status_code == 200
    assert hide.json().get("hidden") is True


def test_posts_search_empty_for_short_query(client: TestClient) -> None:
    response = client.get("/api/posts/search?q=a")
    assert response.status_code == 200
    assert response.json() == []


def test_daily_question_answer_flow(client: TestClient) -> None:
    _, _, headers = register_user(client, prefix="daily")

    today = client.get("/api/daily-question/today", headers=headers)
    assert today.status_code == 200
    body = today.json()
    assert body.get("canAnswer") is True
    assert body.get("hasAnswered") is False
    assert isinstance(body.get("question"), str) and body.get("question")

    answer = client.post(
        "/api/daily-question/answer",
        headers=headers,
        json={"text": "integration daily answer"},
    )
    assert answer.status_code == 201, answer.text
    assert answer.json().get("hasAnswered") is True

    history = client.get("/api/daily-question/me/history?limit=3", headers=headers)
    assert history.status_code == 200
    assert len(history.json().get("answers") or []) >= 1


def test_mood_neighbors_join_and_list(client: TestClient) -> None:
    alpha_name, _, alpha_headers = register_user(client, prefix="neighbor_a")
    beta_name, _, beta_headers = register_user(client, prefix="neighbor_b")

    join = client.post("/api/mood-neighbors/join", headers=alpha_headers)
    assert join.status_code == 200
    assert join.json().get("ok") is True

    mine = client.get("/api/mood-neighbors", headers=alpha_headers)
    assert mine.status_code == 200
    body = mine.json()
    assert isinstance(body.get("snippets"), list)
    assert body.get("count") is not None

    other = client.get("/api/mood-neighbors", headers=beta_headers)
    assert other.status_code == 200


def test_ban_blocks_login_and_block_user(client: TestClient) -> None:
    admin_name, _, admin_headers = register_user(client, prefix="banadmin")
    victim_name, victim_pass, _ = register_user(client, prefix="banvictim")
    blocker_name, _, blocker_headers = register_user(client, prefix="blocker")
    promote_to_admin(admin_name)

    ban = client.patch(
        f"/api/admin/users/{user_id(victim_name)}/ban",
        headers=admin_headers,
        json={"banned": True},
    )
    assert ban.status_code == 200
    assert ban.json().get("banned") is True

    login = client.post(
        "/api/auth/login",
        json={"username": victim_name, "password": victim_pass},
    )
    assert login.status_code == 403

    block = client.post(f"/api/users/{victim_name}/block", headers=blocker_headers)
    assert block.status_code == 200

    blocked_list = client.get("/api/users/me/blocked", headers=blocker_headers)
    assert blocked_list.status_code == 200
    usernames = [row.get("username") for row in blocked_list.json()]
    assert victim_name in usernames
