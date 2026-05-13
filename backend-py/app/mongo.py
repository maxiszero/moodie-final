from datetime import date, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException


def object_id(value: str, field_name: str = "id") -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail={"message": f"Invalid {field_name}"})
    return ObjectId(value)


def stringify_mongo(value: Any) -> Any:
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, list):
        return [stringify_mongo(item) for item in value]
    if isinstance(value, dict):
        return {key: stringify_mongo(item) for key, item in value.items()}
    return value


def mongo_json(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    return stringify_mongo(doc) if doc is not None else None
