import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenOnboarding', '1')
    localStorage.setItem('moodie_welcome_seen', '1')
    localStorage.setItem('moodie_tg_onboarding_seen', '1')
    localStorage.setItem('moodie_getting_started_seen', '1')
  })
})

test('register, publish post, see it in feed', async ({ page }) => {
  const suffix = Date.now().toString(36)
  const username = `e2e_${suffix}`
  const password = 'TestPass1!'
  const postText = `e2e happy path ${suffix} feeling calm today`

  await page.goto('/register')
  await page.locator('#registerUsername').fill(username)
  await page.locator('#registerPassword').fill(password)
  await page.locator('#registerSubmitBtn').click()

  await expect(page.locator('#feedComposer')).toBeVisible({ timeout: 15_000 })
  await page.locator('#postInput').fill(postText)
  await page.locator('#postBtn').click()

  await expect(page.locator('#feedContainer .post-card .post-content', { hasText: postText })).toBeVisible({
    timeout: 30_000,
  })
})
