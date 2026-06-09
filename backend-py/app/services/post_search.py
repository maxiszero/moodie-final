import re
from typing import Any


def post_text_search_filter(raw: str) -> dict[str, Any]:
    """Build a MongoDB filter for post text search (hidden posts excluded)."""
    base: dict[str, Any] = {"hidden": {"$ne": True}}
    tokens = re.findall(r"\w+", raw, flags=re.UNICODE)
    if len(tokens) >= 2:
        return {**base, "$text": {"$search": " ".join(tokens)}}
    return {**base, "text": {"$regex": re.escape(raw), "$options": "i"}}
