#!/usr/bin/env bash
# One-time: copy secrets from legacy backend/.env into backend-py/.env (if still present on server).
set -euo pipefail

ROOT="${1:-/var/www/moodie}"
LEGACY="${ROOT}/backend/.env"
TARGET="${ROOT}/backend-py/.env"

if [[ ! -f "$LEGACY" ]]; then
  echo "No legacy ${LEGACY} — nothing to migrate."
  exit 0
fi

for key in JWT_SECRET MONGODB_URI CORS_ORIGIN; do
  line="$(grep -E "^${key}=" "$LEGACY" || true)"
  if [[ -n "$line" && ! "$(grep -E "^${key}=" "$TARGET" 2>/dev/null || true)" ]]; then
    echo "$line" >> "$TARGET"
    echo "Appended ${key} to ${TARGET}"
  fi
done

if ! grep -qE '^PORT=' "$TARGET" 2>/dev/null; then
  echo 'PORT=8001' >> "$TARGET"
  echo "Appended PORT=8001 to ${TARGET}"
fi

echo "Done. Review ${TARGET} and restart: pm2 restart moodie-backend-py"
