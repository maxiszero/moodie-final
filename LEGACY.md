# Legacy code (не использовать)

Папки **`backend/`** (Node Express) и **`python-service/`** оставлены в репозитории только как архив.

- Разработка и прод: **`backend-py/`** + **`frontend/`**
- `npm run dev` / `npm run start` — только Python API
- Node workspace удалён из корневого `package.json`

Подробнее: `backend/DEPRECATED.md`, `python-service/DEPRECATED.md`.

После стабильного деплоя на moodie.social можно удалить legacy-папки из git отдельным коммитом.

**Env:** перенесите переменные из `backend/.env` в `backend-py/.env`. Python API больше не загружает `backend/.env`.
