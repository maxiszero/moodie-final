# Деплой moodie.social

Краткая инструкция после обновления кода (Python API + React SPA без hash-роутинга).

## Что сейчас должно работать на сервере

| Процесс | Нужен? | Порт |
|---------|--------|------|
| `moodie-backend-py` (PM2) | **Да** | 8001 |
| nginx | **Да** | 443 |
| `moodie-backend` (Node) | **Нет** — legacy, удалить: `pm2 delete moodie-backend` |
| `moodie-python` (старый сервис) | **Нет** — legacy, удалить: `pm2 delete moodie-python` |

Переменные окружения — только в `backend-py/.env` (и опционально корневой `.env`).

Если на сервере ещё есть старый `backend/.env`, один раз перенесите секреты:

```bash
bash deploy/migrate-env.sh /var/www/moodie
```

Мониторинг: [`MONITORING.md`](MONITORING.md).

## Обновление после `git pull`

```bash
cd /var/www/moodie   # или ваш путь к репозиторию

git pull
npm ci
pip install -r backend-py/requirements.txt

# frontend
npm run build
rsync -a --delete frontend/dist/ /var/www/moodie/frontend/dist/   # если dist отдельно

# API
pm2 restart moodie-backend-py
pm2 save
```

Проверка:

```bash
curl -s http://127.0.0.1:8001/health
curl -sI https://moodie.social/ | head -5
curl -sI https://moodie.social/profile/test  # должен отдать index.html (SPA), не 404 nginx
```

## nginx

Используйте [`nginx.conf`](nginx.conf) как образец. Критично для `BrowserRouter`:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Прокси только на Python:

```nginx
location /api/      { proxy_pass http://127.0.0.1:8001; ... }
location /socket.io/ { proxy_pass http://127.0.0.1:8001; ... }
location /share/    { proxy_pass http://127.0.0.1:8001; ... }
```

После правок:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## PM2 (только Python)

Пример: [`ecosystem.config.cjs`](ecosystem.config.cjs)

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 stop moodie-backend moodie-python   # legacy, если ещё запущены
pm2 delete moodie-backend moodie-python # когда убедитесь, что всё ок
pm2 save
```

Переменные окружения — в `backend-py/.env` на сервере (не в git): `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN=https://moodie.social`, Telegram-токены.

## Переменные на проде

| Переменная | Зачем |
|------------|--------|
| `JWT_SECRET` | обязательно, длинный случайный |
| `MONGODB_URI` / `MONGODB_DB_NAME` | Atlas или локальный Mongo |
| `CORS_ORIGIN` | `https://moodie.social` |
| `TELEGRAM_WEB_APP_URL` | `https://moodie.social` |
| `TELEGRAM_ENABLE_POLLING` | `true` только на **одном** воркере API |
| `NODE_ENV=production` | включает проверку JWT на старте |

## Индексы MongoDB

При старте API вызывается `ensure_indexes()` (в т.ч. text index для поиска постов). Достаточно одного рестарта `moodie-backend-py` после деплоя.

## Откат

```bash
git checkout <предыдущий-коммит>
npm run build
pm2 restart moodie-backend-py
```

Сохраните бэкап `frontend/dist` и `.env` перед крупными обновлениями.
