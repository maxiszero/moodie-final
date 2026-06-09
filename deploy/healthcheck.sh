#!/usr/bin/env bash
set -euo pipefail

API_URL="${MOODIE_HEALTH_URL:-http://127.0.0.1:8001/health}"
PM2_APP="${MOODIE_PM2_APP:-moodie-backend-py}"
LOG_TAG="moodie-healthcheck"

notify() {
  local msg="$1"
  echo "$(date -Iseconds) [$LOG_TAG] $msg"
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_ALERT_CHAT_ID:-}" ]]; then
    curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_ALERT_CHAT_ID}" \
      --data-urlencode "text=${msg}" >/dev/null || true
  fi
}

if curl -sf --max-time 10 "$API_URL" >/dev/null; then
  exit 0
fi

notify "Moodie API health check FAILED (${API_URL}). Restarting ${PM2_APP}…"
pm2 restart "$PM2_APP" || notify "PM2 restart failed for ${PM2_APP}"
sleep 3

if curl -sf --max-time 10 "$API_URL" >/dev/null; then
  notify "Moodie API recovered after restart."
  exit 0
fi

notify "Moodie API still DOWN after restart. Manual intervention required."
exit 1
