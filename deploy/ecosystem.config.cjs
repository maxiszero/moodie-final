/** PM2: только FastAPI. Скопируйте на сервер и поправьте cwd / порт. */
module.exports = {
  apps: [
    {
      name: 'moodie-backend-py',
      cwd: '/var/www/moodie',
      script: 'python3',
      args: '-m uvicorn app.main:app --host 127.0.0.1 --port 8001 --app-dir backend-py',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
