import json
import os
import re
from datetime import datetime
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field

from ..config import settings


class WeeklyPost(BaseModel):
    text: str = ""
    emotion: str | None = None
    emoji: str | None = None
    createdAt: datetime | str | None = None


class WeeklySummaryRequest(BaseModel):
    posts: list[WeeklyPost] = Field(default_factory=list)
    lang: Literal["ru", "en"] = "ru"


def clamp_feed_quality(value: Any) -> int | None:
    if not isinstance(value, (int, float)):
        return None
    return min(100, max(0, round(value)))


def estimate_feed_quality(raw_text: str) -> int:
    text = (raw_text or "").strip()
    if len(text) < 8:
        return 38
    if len(text) < 24:
        return 55
    quality = 72
    lower = text.lower()
    if re.search(
        r"купи скорее|кликни|viagra|casino|казино|заработок в интернет|реклама бесплатн|buy now|click here",
        lower,
        re.I,
    ):
        quality = 18
    elif re.search(r"(https?://|www\.)", lower, re.I):
        quality = 25
    elif re.search(r"^(.)\1{12,}$", re.sub(r"\s", "", text), re.U):
        quality = 22
    return quality


def first_emoji(value: str | None, default: str = "😐") -> str:
    if not value:
        return default
    match = re.search(r"[\U0001F300-\U0001F9FF\u2600-\u26FF\u2700-\u27BF]", value)
    return match.group(0) if match else default


def fallback_analysis(text: str) -> dict[str, Any]:
    lower = (text or "").lower()
    result: dict[str, Any] = {
        "emotion": "neutral",
        "emoji": "😐",
        "intensity": 30,
        "color": "#E0E7FF",
        "color2": "#A5B4FC",
        "color3": "#6366F1",
        "reasoning": "Текст кажется нейтральным по смыслу.",
        "tip": "Просто хороший день, чтобы ничего не делать ☁️",
        "feedQuality": estimate_feed_quality(text),
    }
    checks: list[tuple[str, dict[str, Any]]] = [
        (r"апати|всё равно|ничего не чувств|numb|apat", {"emotion": "apathy", "emoji": "😶", "intensity": 40, "color": "#EDE9FE", "color2": "#C4B5FD", "color3": "#6D28D9", "reasoning": "Чувство безразличия.", "tip": "Иногда ничего не чувствовать - это тоже нормально 😶"}),
        (r"спокой|умиротвор|гармон|zen|calm|peaceful", {"emotion": "calm", "emoji": "😌", "intensity": 20, "color": "#99F6E4", "color2": "#5EEAD4", "color3": "#2DD4BF", "reasoning": "Спокойствие и дзен.", "tip": "Вдох-выдох... Поймай этот момент 😌"}),
        (r"меланхол|ностальг|тосклив|wistful|melanchol", {"emotion": "melancholy", "emoji": "🌧️", "intensity": 45, "color": "#C7D2FE", "color2": "#A5B4FC", "color3": "#818CF8", "reasoning": "Светлая грусть или ностальгия.", "tip": "Включи любимый плейлист и помечтай 🌧️"}),
        (r"драйв|рвусь|мотивац|hustle|drive|на подъёме", {"emotion": "driven", "emoji": "🚀", "intensity": 90, "color": "#FED7AA", "color2": "#FDBA74", "color3": "#FB923C", "reasoning": "Энергия и мотивация.", "tip": "Полный вперед! Тебя не остановить 🚀"}),
        (r"тревож|на взводе|anxiety|переживаю|волнуюсь", {"emotion": "anxious", "emoji": "😰", "intensity": 75, "color": "#FDE68A", "color2": "#FCD34D", "color3": "#FBBF24", "reasoning": "Чувство беспокойства.", "tip": "Все будет хорошо, ты со всем справишься ❤️"}),
        (r"вдохнов|идеи|творч|muse|inspir", {"emotion": "inspired", "emoji": "✨", "intensity": 80, "color": "#E9D5FF", "color2": "#D8B4FE", "color3": "#C084FC", "reasoning": "Творческий подъем.", "tip": "Твори и вдохновляй! ✨"}),
        (r"устал|tired|sleep|спать", {"emotion": "tired", "emoji": "😫", "intensity": 60, "color": "#A5B4FC", "color2": "#4F46E5", "color3": "#312E81", "reasoning": "Нужен отдых.", "tip": "Пора отдохнуть и набраться сил 🔋"}),
        (r"любл|love|обожаю", {"emotion": "love", "emoji": "🥰", "intensity": 95, "color": "#FBCFE8", "color2": "#F9A8D4", "color3": "#F472B6", "reasoning": "Теплые чувства.", "tip": "Любовь спасет мир 🥰"}),
        (r"ура|excited|hyped|жду не дождусь", {"emotion": "hyped", "emoji": "🤩", "intensity": 100, "color": "#FEF08A", "color2": "#FDE047", "color3": "#FACC15", "reasoning": "Радостное ожидание.", "tip": "Это будет круто! 🤩"}),
        (r"бесит|angry|mad|ненавижу", {"emotion": "angry", "emoji": "😠", "intensity": 90, "color": "#FECACA", "color2": "#FCA5A5", "color3": "#F87171", "reasoning": "Гнев или раздражение.", "tip": "Выпусти пар, но не давай злости победить 😤"}),
        (r"груст|sad|bad|обидно|плачу", {"emotion": "sad", "emoji": "😢", "intensity": 70, "color": "#BFDBFE", "color2": "#93C5FD", "color3": "#60A5FA", "reasoning": "Грусть или печаль.", "tip": "Плакать - это нормально. Завтра станет легче 🫂"}),
        (r"рад|happy|good|отлично|супер", {"emotion": "happy", "emoji": "😊", "intensity": 80, "color": "#BBF7D0", "color2": "#86EFAC", "color3": "#4ADE80", "reasoning": "Положительные эмоции.", "tip": "Отличное настроение! Так держать 😊"}),
    ]
    if re.search(r"страш|panic|terror|ужас|боюсь", lower, re.I) and not re.search(r"тревож", lower, re.I):
        result.update({"emotion": "scared", "emoji": "😨", "intensity": 85, "color": "#DDD6FE", "color2": "#C4B5FD", "color3": "#A78BFA", "reasoning": "Чувство страха.", "tip": "Ты сильнее, чем кажешься 🛡️"})
    else:
        for pattern, update in checks:
            if re.search(pattern, lower, re.I):
                result.update(update)
                break
    result["feedQuality"] = estimate_feed_quality(text)
    return result


def groq_keys() -> list[str]:
    raw = os.getenv("AI_API_KEYS") or os.getenv("AI_API_KEY") or ""
    return [key.strip() for key in raw.split(",") if key.strip() and key.strip() != "your_ai_api_key_here"]


async def try_groq_analysis(text: str, tip_only: bool = False) -> dict[str, Any] | None:
    keys = groq_keys()
    if not keys:
        return None
    system_prompt = (
        'You are a supportive and empathetic friend. Analyze the text and provide a very short '
        '(max 15 words) supportive tip, advice or a fitting quote in Russian. Respond ONLY with '
        'valid JSON: {"tip": "..."}'
        if tip_only
        else """
You are an AI emotion analyzer. Analyze the text and return a JSON object.
Rules:
1. "emotion" field MUST be EXACTLY ONE English word.
2. "emoji" is a single unicode emoji.
3. "intensity" is a number from 0 to 100.
4. "color1", "color2", "color3" are soft pastel HEX colors.
5. "reasoning" and "tip" must be in Russian, max 20 words each.
6. "feedQuality" is an integer 0-100.
7. Output ONLY valid JSON. No extra text.
"""
    )
    async with httpx.AsyncClient(timeout=12.0) as client:
        for api_key in keys:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                    json={
                        "model": settings.groq_model,
                        "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": text}],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 200,
                        "temperature": 0.7,
                    },
                )
                if not response.is_success:
                    continue
                parsed = json.loads(response.json()["choices"][0]["message"]["content"].strip())
                if tip_only:
                    tip = parsed.get("tip")
                    return {"tip": tip} if isinstance(tip, str) and tip else None
                if not parsed.get("emotion"):
                    continue
                color1 = parsed.get("color1") or parsed.get("color")
                return {
                    "emotion": str(parsed.get("emotion", "neutral")).lower(),
                    "emoji": first_emoji(parsed.get("emoji")),
                    "intensity": parsed.get("intensity") or 50,
                    "color": color1 or "#E0E7FF",
                    "color2": parsed.get("color2") or color1 or "#A5B4FC",
                    "color3": parsed.get("color3") or parsed.get("color2") or color1 or "#6366F1",
                    "reasoning": parsed.get("reasoning") or "",
                    "tip": parsed.get("tip") or "",
                    "feedQuality": clamp_feed_quality(parsed.get("feedQuality")) or estimate_feed_quality(text),
                }
            except Exception:
                continue
    return None


async def try_groq_itunes_search_queries(post_text: str, emotion_tag: str, count: int) -> list[str] | None:
    """LLM suggests iTunes `term` search strings from the user's post + mood (varied artists)."""
    if os.getenv("DISABLE_MOOD_SONG_AI_QUERIES", "").lower() in ("1", "true", "yes"):
        return None
    keys = groq_keys()
    if not keys:
        return None
    n = max(4, min(int(count), 16))
    tag = (emotion_tag or "neutral").strip()[:80]
    snippet = (post_text or "").strip()[:400]
    system = f"""You choose Apple iTunes music search queries for songs that fit the user's mood post.

Mood tag (any language, from an analyzer): {tag}

Return ONLY valid JSON: {{"queries": ["...", ...]}}

Rules:
- The "queries" array must have between 4 and {n} strings (inclusive).
- Each string is one iTunes search: use form "Artist Name Song Title" or short descriptive phrase.
- Prefer Latin script and well-known artists so iTunes Search returns previews.
- Each query must be DIFFERENT (other artist or other song) — do not repeat the same hit.
- Match the emotional tone of the user's words (not generic unrelated party tracks).
- No URLs, no markdown, no keys other than "queries".
- Each string max 90 characters."""

    async with httpx.AsyncClient(timeout=18.0) as client:
        for api_key in keys:
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                    json={
                        "model": settings.groq_model,
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": snippet or "(empty)"},
                        ],
                        "response_format": {"type": "json_object"},
                        "max_tokens": 700,
                        "temperature": 0.88,
                    },
                )
                if not response.is_success:
                    continue
                raw = response.json()["choices"][0]["message"]["content"].strip()
                parsed = json.loads(raw)
                arr = parsed.get("queries")
                if not isinstance(arr, list):
                    continue
                out: list[str] = []
                seen: set[str] = set()
                for item in arr:
                    if not isinstance(item, str):
                        continue
                    s = item.strip()
                    if len(s) < 2 or len(s) > 100:
                        continue
                    if re.search(r"https?://|www\.", s, re.I):
                        continue
                    low = s.lower()
                    if low in seen:
                        continue
                    seen.add(low)
                    out.append(s)
                    if len(out) >= n:
                        break
                return out if len(out) >= 2 else None
            except Exception:
                continue
    return None


async def analyze_emotion(text: str, tip_only: bool = False) -> dict[str, Any]:
    ai_result = await try_groq_analysis(text, tip_only=tip_only)
    if tip_only:
        if ai_result and isinstance(ai_result.get("tip"), str):
            return {"tip": ai_result["tip"]}
        return {"tip": fallback_analysis(text)["tip"]}
    return ai_result or fallback_analysis(text)


def weekly_summary_fallback(posts: list[WeeklyPost], lang: str) -> str:
    if not posts:
        return ""
    counts: dict[str, int] = {}
    for post in posts:
        emotion = post.emotion or "neutral"
        counts[emotion] = counts.get(emotion, 0) + 1
    sorted_counts = sorted(counts.items(), key=lambda item: item[1], reverse=True)
    top = sorted_counts[0] if sorted_counts else None
    second = sorted_counts[1] if len(sorted_counts) > 1 else None
    combined = " ".join((post.text or "").strip() for post in posts)[:400].lower()
    has_work = bool(re.search(r"работ|офис|начальник|deadline|проект|work|boss|job", combined, re.I))
    has_rel = bool(re.search(r"друг|семь|парен|девушк|мам|пап|любов|friend|family|mom|dad", combined, re.I))
    if lang == "en":
        themes = ", ".join([item for item in ["work stress" if has_work else "", "relationships" if has_rel else ""] if item])
        line = f"Over the week ({len(posts)} posts), themes include {themes or 'everyday ups and downs'}."
        if top:
            line += f" Automated mood tags most often: {top[0]}{', then ' + second[0] if second else ''}."
        return line
    themes = ", ".join([item for item in ["работа/нагрузка" if has_work else "", "отношения" if has_rel else ""] if item])
    line = f"За неделю ({len(posts)} публ.): в текстах заметны {themes or 'бытовые перепады'}."
    if top:
        line += f" По авто-тегам чаще «{top[0]}»{', также «' + second[0] + '»' if second else ''}."
    return line
