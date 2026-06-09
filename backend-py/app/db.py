from collections.abc import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import settings

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongodb_uri)
    return _client


def get_database() -> AsyncIOMotorDatabase:
    return get_client().get_default_database(default=settings.mongodb_db_name or "test")


async def db_dependency() -> AsyncIterator[AsyncIOMotorDatabase]:
    yield get_database()


async def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
