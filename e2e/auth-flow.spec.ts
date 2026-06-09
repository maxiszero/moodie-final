import { expect, test } from '@playwright/test'

const apiPort = process.env.E2E_API_PORT || '8000'
const apiBase = process.env.E2E_API_URL || `http://127.0.0.1:${apiPort}`

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenOnboarding', '1')
    localStorage.setItem('moodie_welcome_seen', '1')
    localStorage.setItem('moodie_tg_onboarding_seen', '1')
    localStorage.setItem('moodie_getting_started_seen', '1')
  })
})

test('login and open feed composer', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  const username = `e2e_login_${suffix}`
  const password = 'TestPass1!'

  const reg = await request.post(`${apiBase}/api/auth/register`, {
    data: { username, password, onboardingMood: 'neutral' },
  })
  expect(reg.ok()).toBeTruthy()

  await page.goto('/')
  await page.evaluate(() => {
    localStorage.removeItem('moodie_token')
    localStorage.removeItem('moodie_user')
    localStorage.removeItem('moodie_userId')
    localStorage.removeItem('moodie_role')
  })
  await page.reload()

  await expect(page.locator('#loginForm')).toBeVisible()
  await page.locator('#loginUsername').fill(username)
  await page.locator('#loginPassword').fill(password)
  await page.locator('#loginSubmitBtn').click()

  await expect(page.locator('#feedComposer')).toBeVisible({ timeout: 15_000 })
})
