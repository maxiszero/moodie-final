# Moodie Python Mood Service

FastAPI service for mood analysis and short supportive tips. The Node backend calls it internally and keeps its existing JavaScript fallback if this service is unavailable.

## Setup

```bash
cd python-service
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

Optional `.env` values:

```env
AI_API_KEY=
AI_API_KEYS=
GROQ_MODEL=llama-3.1-8b-instant
PYTHON_SERVICE_PORT=8000
```

## Run

```bash
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

From the repository root you can also run:

```bash
npm run dev:python
```

Useful endpoints:

- `GET /health`
- `POST /analyze` with `{ "text": "..." }`
- `POST /tip` with `{ "text": "..." }`
- `POST /weekly-summary` with `{ "posts": [...], "lang": "ru" }`
