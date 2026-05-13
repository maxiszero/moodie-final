EMOTION_PALETTE: dict[str, dict[str, str]] = {
    "happy": {"color": "#FFD166", "color2": "#FFB703", "color3": "#FB8500"},
    "sad": {"color": "#BFDBFE", "color2": "#60A5FA", "color3": "#2563EB"},
    "anxious": {"color": "#FEF3C7", "color2": "#F59E0B", "color3": "#EA580C"},
    "calmness": {"color": "#CCFBF1", "color2": "#2DD4BF", "color3": "#059669"},
    "angry": {"color": "#FECACA", "color2": "#EF4444", "color3": "#B91C1C"},
    "scared": {"color": "#DDD6FE", "color2": "#8B5CF6", "color3": "#4C1D95"},
    "loved": {"color": "#FBCFE8", "color2": "#EC4899", "color3": "#BE185D"},
    "neutral": {"color": "#9E9E9E", "color2": "#757575", "color3": "#616161"},
    "tired": {"color": "#E7E5E4", "color2": "#A8A29E", "color3": "#57534E"},
    "apathy": {"color": "#E2E8F0", "color2": "#94A3B8", "color3": "#475569"},
    "melancholy": {"color": "#C7D2FE", "color2": "#818CF8", "color3": "#4338CA"},
    "inspiration": {"color": "#E9D5FF", "color2": "#A855F7", "color3": "#7E22CE"},
    "drive": {"color": "#FED7AA", "color2": "#FB923C", "color3": "#C2410C"},
    "excited": {"color": "#FEF08A", "color2": "#FACC15", "color3": "#CA8A04"},
}

EMOTION_ALIASES = {
    "calm": "calmness",
    "love": "loved",
    "inspired": "inspiration",
    "driven": "drive",
    "hyped": "excited",
    "funny": "happy",
}


def normalize_emotion(value: str | None) -> str:
    raw = value.strip().lower() if isinstance(value, str) else "neutral"
    return EMOTION_ALIASES.get(raw, raw or "neutral")


def palette_for_emotion(value: str | None) -> dict[str, str] | None:
    emotion = normalize_emotion(value)
    palette = EMOTION_PALETTE.get(emotion)
    return {"emotion": emotion, **palette} if palette else None
