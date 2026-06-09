import { expect, type APIRequestContext, type Page } from '@playwright/test'

const apiPort = process.env.E2E_API_PORT || '8000'
export const apiBase = process.env.E2E_API_URL || `http://127.0.0.1:${apiPort}`

/** Skip onboarding / welcome modals so flows start on the real UI. */
export async function skipOnboardingModals(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenOnboarding', '1')
    localStorage.setItem('moodie_welcome_seen', '1')
    localStorage.setItem('moodie_tg_onboarding_seen', '1')
    localStorage.setItem('moodie_getting_started_seen', '1')
    localStorage.setItem('moodie_onboarding_mood', 'neutral')
    localStorage.removeItem('moodie_just_registered')
  })
}

type AuthPayload = {
  token: string
  username: string
  _id: string
  role?: string
}

/** Register via API and open an authenticated feed session in the browser. */
export async function openAuthedFeed(
  page: Page,
  request: APIRequestContext,
  prefix = 'e2e',
): Promise<{ username: string; password: string }> {
  const suffix = Date.now().toString(36)
  const username = `${prefix}_${suffix}`
  const password = 'TestPass1!'

  const reg = await request.post(`${apiBase}/api/auth/register`, {
    data: { username, password, onboardingMood: 'neutral' },
  })
  expect(reg.ok()).toBeTruthy()
  const auth = (await reg.json()) as AuthPayload

  await page.goto('/')
  await page.evaluate((payload) => {
    localStorage.setItem('moodie_token', payload.token)
    localStorage.setItem('moodie_user', payload.username)
    localStorage.setItem('moodie_userId', payload._id)
    localStorage.setItem('moodie_role', payload.role || 'user')
  }, auth)
  await page.reload()

  await expect(page.locator('#feedComposer')).toBeVisible({ timeout: 30_000 })
  return { username, password }
}

/** Publish post text; skips mood-song picker when it appears (iTunes may return tracks in CI). */
export async function publishPost(page: Page, text: string) {
  await page.locator('#postInput').fill(text)
  await page.locator('#postBtn').click()

  const songModal = page.locator('.mood-song-pick-modal')
  try {
    await songModal.waitFor({ state: 'visible', timeout: 8_000 })
    await page.locator('[data-testid="mood-song-skip"]').click()
  } catch {
    /* MOODIE_E2E or no iTunes hits — post goes straight through */
  }
}
