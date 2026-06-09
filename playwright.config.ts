import { defineConfig, devices } from '@playwright/test'

const apiPort = process.env.E2E_API_PORT || '8000'
const webPort = process.env.E2E_WEB_PORT || '5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `python -m uvicorn app.main:app --host 127.0.0.1 --port ${apiPort} --app-dir backend-py`,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        JWT_SECRET: process.env.JWT_SECRET || 'e2e-test-secret',
        MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/moodie_e2e',
        TELEGRAM_ENABLE_POLLING: 'false',
      },
    },
    {
      command: `npm run dev --workspace frontend -- --host 127.0.0.1 --port ${webPort}`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
