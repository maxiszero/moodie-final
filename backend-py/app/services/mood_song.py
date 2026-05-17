from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any

import httpx

from ..config import settings


@dataclass(frozen=True)
class MoodSong:
    title: str
    artist: str
    previewUrl: str
    externalUrl: str
    artworkUrl: str = ""
    source: str = "itunes"


MOOD_SONG_QUERIES: dict[str, list[str]] = {
    "happy": [
        "Pharrell Williams Happy",
        "Walking On Sunshine Katrina and the Waves",
        "Good Life OneRepublic",
    ],
    "excited": [
        "The Weeknd Blinding Lights",
        "Dua Lipa Levitating",
        "Avicii The Nights",
    ],
    "hyped": [
        "The Weeknd Blinding Lights",
        "Dua Lipa Levitating",
        "Avicii The Nights",
    ],
    "calm": [
        "Petit Biscuit Sunset Lover",
        "Tycho Awake",
        "Coldplay Sparks",
    ],
    "calmness": [
        "Petit Biscuit Sunset Lover",
        "Tycho Awake",
        "Coldplay Sparks",
    ],
    "sad": [
        "Joji Glimpse of Us",
        "Billie Eilish ocean eyes",
        "The Neighbourhood Sweater Weather",
    ],
    "melancholy": [
        "The Neighbourhood Sweater Weather",
        "Lord Huron The Night We Met",
        "Cigarettes After Sex Apocalypse",
    ],
    "tired": [
        "Sufjan Stevens Mystery of Love",
        "Bon Iver Holocene",
        "Novo Amor Anchor",
    ],
    "anxious": [
        "Mac Miller Good News",
        "Coldplay Fix You",
        "AURORA Runaway",
    ],
    "anxiety": [
        "Mac Miller Good News",
        "Coldplay Fix You",
        "AURORA Runaway",
    ],
    "angry": [
        "Linkin Park Numb",
        "Imagine Dragons Believer",
        "Arctic Monkeys Do I Wanna Know",
    ],
    "scared": [
        "AURORA Runaway",
        "Coldplay Fix You",
        "Sleeping At Last Saturn",
    ],
    "love": [
        "JVKE golden hour",
        "Ed Sheeran Perfect",
        "Stephen Sanchez Until I Found You",
    ],
    "loved": [
        "JVKE golden hour",
        "Ed Sheeran Perfect",
        "Stephen Sanchez Until I Found You",
    ],
    "inspired": [
        "M83 Midnight City",
        "ODESZA A Moment Apart",
        "Avicii The Nights",
    ],
    "inspiration": [
        "M83 Midnight City",
        "ODESZA A Moment Apart",
        "Avicii The Nights",
    ],
    "driven": [
        "Imagine Dragons Whatever It Takes",
        "Kanye West Stronger",
        "The Score Unstoppable",
    ],
    "drive": [
        "Imagine Dragons Whatever It Takes",
        "Kanye West Stronger",
        "The Score Unstoppable",
    ],
    "apathy": [
        "Radiohead No Surprises",
        "Beach House Space Song",
        "Mac DeMarco Chamber of Reflection",
    ],
    "neutral": [
        "The Neighbourhood Sweater Weather",
        "Tame Impala The Less I Know The Better",
        "Frank Ocean Pink + White",
    ],
}


def normalize_emotion(value: str | None) -> str:
    raw = (value or "neutral").strip().lower()
    return raw if raw in MOOD_SONG_QUERIES else "neutral"


def query_for_mood(emotion: str | None, text: str = "") -> str:
    mood = normalize_emotion(emotion)
    candidates = MOOD_SONG_QUERIES[mood]
    seed = f"{mood}|{text.strip().lower()}".encode("utf-8")
    idx = int(hashlib.sha256(seed).hexdigest()[:8], 16) % len(candidates)
    return candidates[idx]


def _song_from_itunes(item: dict[str, Any]) -> MoodSong | None:
    title = item.get("trackName")
    artist = item.get("artistName")
    preview_url = item.get("previewUrl")
    external_url = item.get("trackViewUrl") or item.get("collectionViewUrl")
    if not all(isinstance(v, str) and v.strip() for v in (title, artist, preview_url, external_url)):
        return None
    artwork = item.get("artworkUrl100") if isinstance(item.get("artworkUrl100"), str) else ""
    if artwork:
        artwork = artwork.replace("100x100bb", "300x300bb")
    return MoodSong(
        title=title.strip(),
        artist=artist.strip(),
        previewUrl=preview_url.strip(),
        externalUrl=external_url.strip(),
        artworkUrl=artwork.strip(),
    )


async def search_itunes_song(query: str, *, country: str | None = None) -> MoodSong | None:
    if not query.strip():
        return None
    params = {
        "term": query.strip(),
        "media": "music",
        "entity": "song",
        "limit": "5",
        "country": (country or settings.itunes_search_country or "US").upper(),
    }
    async with httpx.AsyncClient(timeout=6.0) as client:
        response = await client.get("https://itunes.apple.com/search", params=params)
        response.raise_for_status()
        data = response.json()
    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        return None
    for item in results:
        if isinstance(item, dict):
            song = _song_from_itunes(item)
            if song:
                return song
    return None


async def pick_mood_song(emotion: str | None, text: str = "", *, country: str | None = None) -> MoodSong | None:
    mood = normalize_emotion(emotion)
    first_query = query_for_mood(mood, text)
    tried: set[str] = set()
    for query in [first_query, *MOOD_SONG_QUERIES[mood], *MOOD_SONG_QUERIES["neutral"]]:
        if query in tried:
            continue
        tried.add(query)
        try:
            song = await search_itunes_song(query, country=country)
        except httpx.HTTPError:
            song = None
        if song:
            return song
    return None


def song_payload(song: MoodSong | None) -> dict[str, str] | None:
    if not song:
        return None
    return {
        "moodSongTitle": song.title,
        "moodSongArtist": song.artist,
        "moodSongPreviewUrl": song.previewUrl,
        "moodSongExternalUrl": song.externalUrl,
        "moodSongArtworkUrl": song.artworkUrl,
        "moodSongSource": song.source,
    }
