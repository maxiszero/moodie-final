import asyncio
import os
from contextlib import asynccontextmanager, suppress
from collections.abc import AsyncIterator

import socketio
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .db import close_client
from .indexes import ensure_indexes
from .realtime import sio
from .routers import admin, auth, daily_question, mood_song, posts, users
from .services.daily_question import utc_day_key
from .services.telegram_bot import start_telegram_background_tasks


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await ensure_indexes()

    async def daily_rollover_watch() -> None:
        last = utc_day_key()
        while True:
            await asyncio.sleep(45)
            dk = utc_day_key()
            if dk != last:
                last = dk
                await sio.emit("daily_question_day", {"dayKey": dk})

    rollover_task = asyncio.create_task(daily_rollover_watch())
    tg_tasks = start_telegram_background_tasks()
    yield
    rollover_task.cancel()
    with suppress(asyncio.CancelledError):
        await rollover_task
    for t in tg_tasks:
        t.cancel()
    for t in tg_tasks:
        with suppress(asyncio.CancelledError):
            await t
    await close_client()


def create_app() -> FastAPI:
    app = FastAPI(title="Moodie Python API", lifespan=lifespan)

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_origins),
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "Authorization"],
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        if isinstance(exc.detail, dict) and "message" in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"message": str(exc.detail)})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"message": "Validation failed", "details": exc.errors()})

    @app.get("/")
    async def root() -> str:
        return "Moodie Python API is running..."

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router, prefix="/api")
    app.include_router(posts.router, prefix="/api")
    app.include_router(users.router, prefix="/api")
    app.include_router(daily_question.router, prefix="/api")
    app.include_router(mood_song.router, prefix="/api")
    app.include_router(admin.router, prefix="/api")
    return app


fastapi_app = create_app()
app = socketio.ASGIApp(sio, fastapi_app)


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", settings.port)),
        reload=True,
    )
