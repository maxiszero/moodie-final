from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..services.mood_song import pick_mood_song, song_payload

router = APIRouter(prefix="/mood-song", tags=["mood-song"])


class MoodSongRequest(BaseModel):
    emotion: str = "neutral"
    text: str = ""
    country: str | None = None


@router.post("/pick")
async def pick_song(body: MoodSongRequest) -> dict[str, Any]:
    song = await pick_mood_song(body.emotion, body.text, country=body.country)
    return {"song": song_payload(song)}
