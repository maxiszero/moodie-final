import { expect, test } from '@playwright/test'
import { skipOnboardingModals } from './helpers'

test.beforeEach(async ({ page }) => {
  await skipOnboardingModals(page)
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
  await expect(page.locator('#loginForm')).toBeHidden()
})

test('search page is reachable', async ({ page }) => {
  await page.goto('/search')
  await expect(page.locator('#searchView')).toBeVisible({ timeout: 15_000 })
})
