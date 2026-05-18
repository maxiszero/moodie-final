# Moodie

**Moodie** — соцсеть про настроения: короткие посты с эмоцией, реакции и комментарии, вопрос дня, подписки, профили, лёгкие тесты самопознания, Telegram Mini App и бот. Есть ИИ‑разбор настроения, подсказки и **экспорт/импорт пользовательских настроек в CSV** (Python API) для бэкапа и учебных требований к файловому I/O.

## Features

- **Лента** — посты с палитрой по эмоции, реакции, комментарии, фильтр по настроению, смешение «под моё настроение»
- **Профиль** — аватар с градиентом настроения, сводка ИИ за неделю, песня настроения (preview), достижения
- **Вопрос дня** — общий вопрос по «корзине» настроения, анонимные ответы
- **Тесты** — опросник эмоций, короткий MBTI (локальные результаты)
- **Настройки** — язык (ru/en), тема, стиль градиентов настроения, пароль, уведомления (в т.ч. Telegram)
- **Telegram** — вход/привязка, Mini App, напоминания (в Python API)
- **Админка** — базовые операции для роли admin
- **CSV настроек** (FastAPI) — `GET` экспорт и `POST` импорт — см. раздел [Python API (backend-py)](#python-api-backend-py)

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 19, TypeScript, Vite, React Router, Framer Motion, Socket.IO client |
| API (primary in many setups) | Node.js, Express, TypeScript, Mongoose, Socket.IO, JWT |
| API (alternate / full Python) | **FastAPI**, Motor (async MongoDB), python-socketio, Pydantic |
| Mood microservice | **FastAPI** (`python-service`) — анализ текста и подсказки (`/analyze`, `/tip`) |
| Data | MongoDB |
| AI | Groq / fallback-анализатор; опционально другие ключи из `.env` |
| Tests | Vitest (frontend), Vitest + Supertest (backend), **pytest** (backend-py) |

## Requirements

- **Node.js** 20+
- **npm** 10+
- **Python** 3.10+
- **MongoDB** (локально или Atlas)

## Quick start

### 1. Clone and install (monorepo root)

```bash
git clone <your-repo-url> moodie
cd moodie
npm install
```

### 2. Environment

**Node backend** — создай `backend/.env` (см. пример в документации ниже или в репозитории). Минимум:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/moodie
JWT_SECRET=use-a-long-random-secret
CORS_ORIGIN=http://localhost:5173
PYTHON_MOOD_SERVICE_URL=http://127.0.0.1:8000
```

**Python full API** (опционально) — скопируй `backend-py/.env.example` в `backend-py/.env` и заполни `MONGODB_URI`, `JWT_SECRET`, при необходимости `CORS_ORIGIN`, ключи ИИ и Telegram.

**Mood microservice** — в `python-service/` создай venv и `pip install -r requirements.txt`; переменные по необходимости (Groq и т.д.).

### 3. Python dependencies (microservice + API tests)

```bash
cd python-service
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
python -m pip install -r requirements.txt
cd ..

cd backend-py
python -m pip install -r requirements.txt
cd ..
```

### 4. Development

**Frontend + Node API + Python microservice** (как в `npm run dev` — параллельно три процесса):

```bash
npm run dev
```

Отдельно:

```bash
npm run dev:frontend      # Vite → http://localhost:5173
npm run dev:backend       # Express API (порт из backend/.env)
npm run dev:python        # backend-py FastAPI на :8000 (--app-dir backend-py)
npm run dev:python-backend
```

**Порты по умолчанию**

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Node API | http://localhost:5000 |
| FastAPI full stack (`backend-py`) | http://127.0.0.1:8000 |
| Mood microservice (`python-service`) | http://127.0.0.1:8000 — **не запускай одновременно с `dev:python-backend` на том же порту** |

В `package.json` корневой скрипт `dev` поднимает **backend-py на 8000** и отдельно Node. Microservice для Express обычно настраивают на **другой порт** (например `8001`) через отдельную команду uvicorn, либо в деве используют только fallback анализа в Node без microservice. Под свой сценарий поправь `PYTHON_MOOD_SERVICE_URL` и порты.

### 5. Production build

```bash
npm run build
npm run start --workspace backend
```

Статическая раздача фронта — из `frontend/dist` (nginx, CDN или хостинг).

## Checks

```bash
npm run build              # backend + frontend
npm run test               # Node backend tests + frontend unit tests
npm run test:python        # pytest в backend-py (CSV, AI helpers, health, …)
npm run lint               # frontend ESLint
```

Отдельно по воркспейсам:

```bash
npm run build --workspace backend
npm run build --workspace frontend
npm run test --workspace backend
npm run test:run --workspace frontend
```

## Python API (`backend-py`)

Отдельное приложение **FastAPI** с тем же MongoDB и JWT, что и Node-вариант (см. `backend-py/.env.example`).

- Запуск: `npm run dev:python-backend` или из каталога `backend-py`:  
  `python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Health: `GET http://127.0.0.1:8000/health`

### Settings CSV (экспорт / импорт)

Требует заголовок `Authorization: Bearer <JWT>` после логина через этот же API.

| Method | Path | Описание |
|--------|------|----------|
| `GET` | `/api/users/me/settings/export` | Скачать `moodie_settings.csv` (UTF-8): язык, тема, флаги Telegram-уведомлений |
| `POST` | `/api/users/me/settings/import` | `multipart/form-data`, поле `file` — `.csv` в том же формате |

Логика разбора и записи — модуль `backend-py/app/services/settings_csv.py` (модуль `csv` из стандартной библиотеки). Подробнее о палитре эмоций: `docs/PALETTE.md`.

### Другие Python части

- **`python-service/`** — лёгкий сервис анализа настроения для Node (`PYTHON_MOOD_SERVICE_URL`).
- Миграция палитры в Mongo (опционально): из `backend/` — `npm run migrate:emotion-palette` (см. `backend/package.json`).

## Telegram Mini App

Не коммить токен бота. Если токен засветился — `/revoke` в BotFather и новый токен только в env.

Нужны: бот, HTTPS URL фронта, доступный бэкенд (`CORS_ORIGIN`). Настройка кнопки меню:

```bash
set TELEGRAM_BOT_TOKEN=...
set TELEGRAM_WEB_APP_URL=https://your-domain.com
set TELEGRAM_BOT_SHORT_NAME=Moodie
npm run telegram:setup
```

PowerShell: `$env:TELEGRAM_BOT_TOKEN="..."` и т.д.

## Project structure (overview)

```text
frontend/          React SPA
backend/           Express + Mongoose API
backend-py/        FastAPI + Motor API (optional full backend)
python-service/    FastAPI mood analysis microservice
docs/              PALETTE.md и прочая документация
scripts/           setupTelegramBot.mjs
```

## Screenshots

Добавьте в репозиторий папку `docs/screenshots/` (или в описание релиза) и вставьте сюда ссылки, например:

- Лента и карточка поста  
- Профиль и баннер настроения  
- Настройки / экспорт CSV (опционально)

## Team & roles

| Role | Name | Responsibility (example) |
|------|------|----------------------------|
| … | … | Frontend, UI |
| … | … | Node API, realtime |
| … | … | Python API, AI, Telegram |

*Заполните таблицу под команду или укажите «индивидуальный проект».*

## Academic / integrity

Если учебное заведение требует декларацию использования ИИ — укажите в отчёте, какие части кода или текстов рецензировались вручную.

## License

Укажите лицензию проекта при публикации (или проприетарно).
