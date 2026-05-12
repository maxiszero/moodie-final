# Moodie

Moodie is a mood-focused social app with a React frontend and an Express/MongoDB backend. Users can post short mood updates, react to posts, answer daily questions, follow profiles, and use lightweight self-reflection tests.

## Stack

- Frontend: React, TypeScript, Vite, React Router, Socket.IO client
- Backend: Express, TypeScript, MongoDB/Mongoose, Socket.IO, JWT auth
- Python service: FastAPI mood analysis and supportive tips
- Tests: Vitest, Testing Library, Supertest

## Requirements

- Node.js 20+
- npm 10+
- Python 3.10+
- MongoDB connection string

## Setup

Install all workspace dependencies from the repository root:

```bash
npm install
```

Create `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.example/moodie
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:5173

# Optional
AI_API_KEY=
AI_API_KEYS=
GEMINI_API_KEY=
PYTHON_MOOD_SERVICE_URL=http://127.0.0.1:8000
# Optional: set true to force JS fallback without calling Python
DISABLE_PYTHON_MOOD_SERVICE=false
ENABLE_ADMIN_BOOTSTRAP=false
ADMIN_USERNAME=
ALLOW_FIRST_ADMIN=false
```

Install Python service dependencies:

```bash
cd python-service
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
cd ..
```

## Development

Run frontend and backend together:

```bash
npm run dev
```

Run frontend, backend, and the Python mood service together:

```bash
npm run dev:with-python
```

Run one side only:

```bash
npm run dev:frontend
npm run dev:backend
npm run dev:python
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- Python mood service: `http://127.0.0.1:8000`

The Python service is used for mood analysis (`/analyze`) and AI tips (`/tip`). If it is not running or returns an error, the backend automatically uses the existing JavaScript fallback so posting still works.

## Checks

```bash
npm run build
npm run test
npm run lint
```

Workspace-specific commands are also available:

```bash
npm run build --workspace backend
npm run test --workspace backend
npm run build --workspace frontend
npm run test:run --workspace frontend
```

## Production

Build both workspaces:

```bash
npm run build
```

Start the backend from compiled TypeScript:

```bash
npm run start --workspace backend
```

The frontend production assets are emitted to `frontend/dist`.

## Telegram Mini App

Moodie can run as a Telegram Mini App while keeping the existing Moodie login/register flow.

Security note: never commit or paste a Telegram bot token into source files. If a token was shared publicly or in chat, revoke it in BotFather with `/revoke` and use the new token only through environment variables.

Requirements:

- A Telegram bot created in BotFather
- A public HTTPS URL for the Moodie frontend
- A backend reachable from that frontend, either same-origin `/api` or allowed with `CORS_ORIGIN`

Recommended production shape:

```text
https://your-domain.com       -> frontend/dist
https://your-domain.com/api   -> Express backend
127.0.0.1:8000                -> Python mood service
```

If frontend and backend use different domains, set `CORS_ORIGIN` in `backend/.env`:

```env
CORS_ORIGIN=https://your-domain.com
```

Configure the bot menu button:

```bash
set TELEGRAM_BOT_TOKEN=replace-with-new-botfather-token
set TELEGRAM_WEB_APP_URL=https://your-domain.com
set TELEGRAM_BOT_SHORT_NAME=Moodie
npm run telegram:setup
```

PowerShell syntax:

```powershell
$env:TELEGRAM_BOT_TOKEN="replace-with-new-botfather-token"
$env:TELEGRAM_WEB_APP_URL="https://your-domain.com"
$env:TELEGRAM_BOT_SHORT_NAME="Moodie"
npm run telegram:setup
```

After setup, open the bot in Telegram and use the menu button to launch Moodie.

## Project Structure

```text
backend/
  src/
    app.ts              Express app factory for runtime and tests
    server.ts           HTTP + Socket.IO startup
    controllers/        Route handlers
    models/             Mongoose models
    routes/             Express routers
    middleware/         Auth, admin, rate limit, errors
    utils/              AI, daily question, IP helpers
frontend/
  src/
    components/         Shared UI components
    routes/             Lazy-loaded pages
    state/              Session and feed state
    realtime/           Socket.IO client context
    ui/                 UI utilities
python-service/
  main.py               FastAPI mood analysis service
  requirements.txt      Python dependencies
scripts/
  setupTelegramBot.mjs  Telegram Mini App menu setup
```
