from typing import Any

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.ai import analyze_emotion
from ..services.mood_song import pick_mood_song, pick_mood_song_candidates, song_payload

router = APIRouter(prefix="/mood-song", tags=["mood-song"])

LINK_RE = re.compile(r"(https?://\S+|www\.\S+)", re.I)


class MoodSongRequest(BaseModel):
    emotion: str = "neutral"
    text: str = ""
    country: str | None = None


class MoodSongSuggestRequest(BaseModel):
    text: str = ""
    limit: int = Field(default=5, ge=1, le=8)
    country: str | None = None


@router.post("/pick")
async def pick_song(body: MoodSongRequest) -> dict[str, Any]:
    song = await pick_mood_song(body.emotion, body.text, country=body.country)
    return {"song": song_payload(song)}


@router.post("/suggest")
async def suggest_songs(body: MoodSongSuggestRequest) -> dict[str, Any]:
    raw = body.text.strip()
    if not raw:
        raise HTTPException(status_code=400, detail={"message": "Text required"})
    if len(raw) > 228:
        raise HTTPException(status_code=400, detail={"message": "Text too long"})
    if LINK_RE.search(raw):
        raise HTTPException(status_code=400, detail={"message": "Links are not allowed"})
    analysis = await analyze_emotion(raw)
    emotion = str(analysis.get("emotion") or "neutral").lower()
    songs = await pick_mood_song_candidates(emotion, raw, limit=body.limit, country=body.country)
    payloads = [song_payload(s) for s in songs]
    return {"emotion": emotion, "songs": [p for p in payloads if p]}
