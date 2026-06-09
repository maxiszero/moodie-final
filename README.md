# Moodie

**Moodie** is a mood-centered social network: short posts with emotion and color, empathetic reactions, comments, profiles, daily questions, self-discovery tests, and a **Telegram Mini App** with a companion bot. Text posts are analyzed for mood (AI with local fallback), and user settings can be exported and imported as CSV.

**Live:** [moodie.social](https://moodie.social)

---

## Features

- **Feed** — mood-colored posts, reactions, comments, sort modes (latest, trending, following, for you), mood filter, mood-mix mode, infinite scroll
- **Profile** — mood gradient banner, weekly AI summary, mood song with preview, achievements, activity streak, mood heatmap calendar
- **Daily question** — shared question per mood bucket, anonymous answers, day rollover via WebSocket
- **Tests** — emotion questionnaire, short MBTI, stress test; history stored in the browser
- **Settings** — language (RU/EN), theme, mood gradient style, password, blocked users, Telegram notification preferences
- **Telegram** — WebApp login, account linking, bot commands, daily and evening reminders, activity alerts
- **Sharing** — Open Graph previews for profiles and posts
- **Admin** — user ban, post moderation
- **Settings CSV** — export/import user preferences via the Python API (`GET` / `POST` on `/api/users/me/settings/export` and `/import`)

---

## Technologies

| Layer | Stack |
|-------|--------|
| **Frontend** | React 19, TypeScript, Vite, React Router, Framer Motion, Socket.IO client |
| **API** | FastAPI (`backend-py`), Motor (async MongoDB), Pydantic, python-socketio, JWT |
| **Legacy** | `backend/` (Express) and `python-service/` — deprecated; not used in dev/prod |
| **Mood analysis** | In-process in `backend-py` (`ai.py`) — Groq/Gemini with rule-based fallback |
| **Database** | MongoDB |
| **Integrations** | Telegram Bot API, iTunes Search (mood songs) |
| **Testing** | Vitest (frontend), pytest (Python API), Playwright (E2E smoke) |

---

## Requirements

- **Node.js** 20+
- **npm** 10+
- **Python** 3.10+
- **MongoDB** (local or Atlas)

---

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/maxiszero/moodie-final.git moodie
cd moodie
npm install
```

### 2. Environment variables

**API (Python)** — copy `backend-py/.env.example` to `backend-py/.env` and set `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, and optionally AI keys (`AI_API_KEY`, `GEMINI_API_KEY`) and Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEB_APP_URL`).

> `backend/` (Node) and `python-service/` are **legacy** and no longer required for dev or production. The FastAPI app in `backend-py/` is the single backend.

**Python API dependencies:**

```bash
cd backend-py
pip install -r requirements.txt
cd ..
```

---

## How to run

### Development (recommended)

Starts the frontend and FastAPI API together:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| FastAPI (`backend-py`) | http://127.0.0.1:8000 |
| OpenAPI docs | http://127.0.0.1:8000/docs |

Run services separately if needed:

```bash
npm run dev:frontend   # Vite
npm run dev:backend    # FastAPI (uvicorn)
```

### Production build

```bash
npm run build
npm run start
```

Serve `frontend/dist` with nginx or any static host. Proxy `/api`, `/socket.io`, and `/share` to the FastAPI process (`backend-py`, default port 8000). Example config: [`deploy/nginx.conf`](deploy/nginx.conf). Step-by-step production update (RU): [`deploy/DEPLOY.md`](deploy/DEPLOY.md).

### Health checks

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/
```

### Tests and lint

```bash
npm run build
npm run test
npm run test:python
npm run test:e2e    # needs MongoDB + Playwright (npx playwright install chromium)
npm run lint
```

### Telegram Mini App setup

Requires a bot token, HTTPS frontend URL, and matching `CORS_ORIGIN`. Never commit tokens to git.

```bash
# Windows CMD
set TELEGRAM_BOT_TOKEN=your-token
set TELEGRAM_WEB_APP_URL=https://your-domain.com
set TELEGRAM_BOT_SHORT_NAME=Moodie
npm run telegram:setup
```

```powershell
# PowerShell
$env:TELEGRAM_BOT_TOKEN="your-token"
$env:TELEGRAM_WEB_APP_URL="https://your-domain.com"
npm run telegram:setup
```

---

## Project structure

```text
frontend/          React SPA (pages, components, i18n)
backend-py/        FastAPI + Motor API, Telegram bot, CSV I/O
backend/           legacy Express API (deprecated — do not run)
python-service/    legacy mood microservice (deprecated)
deploy/            nginx, PM2, DEPLOY.md, MONITORING.md, healthcheck.sh
LEGACY.md          deprecated Node/python-service folders
e2e/               Playwright smoke + happy-path tests
.github/workflows/ CI (pytest, lint, build, E2E)
docs/              PALETTE.md (emotion colors)
scripts/           Telegram bot setup (setupTelegramBot.mjs)
```

Additional docs: [emotion palette](docs/PALETTE.md)

---

## Production monitoring

See [`deploy/MONITORING.md`](deploy/MONITORING.md) for health checks and optional Telegram alerts.

---

## Team roles

| Role | Responsibilities |
|------|------------------|
| **Frontend** | React UI, routing, mobile layout, i18n (RU/EN), Telegram Mini App integration, Socket.IO client |
| **Backend (Python)** | FastAPI routers, Pydantic validation, MongoDB access, CSV export/import, pytest, Socket.IO |
| **Telegram & integrations** | Bot commands, schedulers, WebApp auth, notification settings |
| **AI & mood services** | Emotion analysis, weekly summaries, mood song suggestions, fallback logic |
| **DevOps** | Deployment, nginx, PM2, environment configuration, production monitoring |

---

## License

Proprietary — all rights reserved unless a license file is added to the repository.
