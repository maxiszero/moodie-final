from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import HTTPException, Request
from fastapi.security.utils import get_authorization_scheme_param

from .config import settings
from .mongo import object_id


def require_jwt_secret() -> str:
    secret = settings.jwt_secret.strip()
    if not secret:
        raise RuntimeError("Missing required env: JWT_SECRET")
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (TypeError, ValueError):
        return False


def create_token(user_id: Any) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.jwt_expires_days)
    payload = {"id": str(user_id), "exp": expires_at}
    return jwt.encode(payload, require_jwt_secret(), algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, require_jwt_secret(), algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail={"message": "Not authorized, token failed"}) from None


def bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization")
    scheme, credentials = get_authorization_scheme_param(authorization)
    if scheme.lower() != "bearer" or not credentials:
        return None
    return credentials


def token_user_id(request: Request) -> str | None:
    token = bearer_token(request)
    if not token:
        return None
    decoded = decode_token(token)
    user_id = decoded.get("id")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail={"message": "Not authorized, token failed"})
    try:
        object_id(user_id, "token id")
    except HTTPException:
        raise HTTPException(status_code=401, detail={"message": "Not authorized, token failed"}) from None
    return user_id


def client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()[:45]
    host = request.client.host if request.client else ""
    if host.startswith("::ffff:"):
        host = host[7:]
    return host[:45]
