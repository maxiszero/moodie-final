import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenOnboarding', '1')
    localStorage.setItem('moodie_welcome_seen', '1')
    localStorage.setItem('moodie_tg_onboarding_seen', '1')
  })
})

test('homepage loads login shell', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.locator('#loginForm')).toBeVisible()
  await expect(page).toHaveTitle(/Moodie/i)
})

test('register page renders auth form', async ({ page }) => {
  await page.goto('/register')
  await expect(page.locator('#registerForm')).toBeVisible()
})

test('search page is reachable', async ({ page }) => {
  await page.goto('/search')
  await expect(page.locator('#searchView, .search-page, main').first()).toBeVisible()
})
