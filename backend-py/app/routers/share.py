"""Public HTML pages with Open Graph tags for link previews (Telegram, social)."""

from html import escape

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse

from ..config import settings
from ..db import get_database

router = APIRouter(tags=["share"])


def _app_base(request: Request) -> str:
    url = settings.telegram_web_app_url.strip()
    if url.startswith("https://"):
        return url.rstrip("/")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    return f"{proto}://{host}".rstrip("/") if host else ""


def _og_html(*, title: str, description: str, url: str, image: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{escape(title)}</title>
<meta property="og:type" content="website"/>
<meta property="og:title" content="{escape(title)}"/>
<meta property="og:description" content="{escape(description)}"/>
<meta property="og:url" content="{escape(url)}"/>
<meta property="og:image" content="{escape(image)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta http-equiv="refresh" content="0;url={escape(url)}"/>
</head>
<body><p><a href="{escape(url)}">{escape(title)}</a></p></body>
</html>"""


@router.get("/share/profile/{username}", response_class=HTMLResponse)
async def share_profile(username: str, request: Request) -> HTMLResponse:
    db = get_database()
    user = await db.users.find_one({"username": username, "banned": {"$ne": True}}, {"username": 1, "currentEmoji": 1, "currentEmotion": 1})
    if not user:
        raise HTTPException(status_code=404, detail="Not found")
    base = _app_base(request)
    hash_url = f"{base}/#/profile/{user.get('username', username)}"
    emoji = user.get("currentEmoji") or "😐"
    emotion = user.get("currentEmotion") or "neutral"
    title = f"@{user.get('username', username)} — Moodie"
    description = f"{emoji} {emotion} — mood profile on Moodie"
    image = f"{base}/logo.png"
    return HTMLResponse(_og_html(title=title, description=description, url=hash_url, image=image))


@router.get("/share/post/{post_id}", response_class=HTMLResponse)
async def share_post(post_id: str, request: Request) -> HTMLResponse:
    db = get_database()
    try:
        oid = ObjectId(post_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Not found") from exc
    post = await db.posts.find_one({"_id": oid, "hidden": {"$ne": True}}, {"text": 1, "emoji": 1, "userId": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    author = await db.users.find_one({"_id": post.get("userId")}, {"username": 1, "banned": 1})
    if not author or author.get("banned"):
        raise HTTPException(status_code=404, detail="Not found")
    base = _app_base(request)
    author_name = author.get("username") or "Moodie"
    hash_url = f"{base}/#/profile/{author_name}?post={post_id}"
    snippet = " ".join(str(post.get("text") or "").split())[:160]
    emoji = post.get("emoji") or "😐"
    title = f"{emoji} @{author_name} on Moodie"
    description = snippet or "Mood post on Moodie"
    image = f"{base}/logo.png"
    return HTMLResponse(_og_html(title=title, description=description, url=hash_url, image=image))
