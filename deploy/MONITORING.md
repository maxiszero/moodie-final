# Мониторинг moodie.social

## Health check (каждые 5 минут)

Добавьте в crontab на сервере (`crontab -e`):

```bash
*/5 * * * * /var/www/moodie/deploy/healthcheck.sh >> /var/log/moodie-health.log 2>&1
```

Скрипт [`healthcheck.sh`](healthcheck.sh) проверяет `/health` на `127.0.0.1:8001` и при сбое перезапускает PM2 + шлёт алерт в Telegram (если задан `TELEGRAM_BOT_TOKEN` и `TELEGRAM_ALERT_CHAT_ID`).

## Ручная проверка

```bash
curl -sf http://127.0.0.1:8001/health
pm2 status moodie-backend-py
pm2 logs moodie-backend-py --lines 50
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) гоняет pytest, lint, build и E2E при push в `main`/`master`.
