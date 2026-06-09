import type { Page } from '@playwright/test'

/** Skip onboarding / welcome modals so flows start on the real UI. */
export async function skipOnboardingModals(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('hasSeenOnboarding', '1')
    localStorage.setItem('moodie_welcome_seen', '1')
    localStorage.setItem('moodie_tg_onboarding_seen', '1')
    localStorage.setItem('moodie_getting_started_seen', '1')
    localStorage.removeItem('moodie_just_registered')
  })
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
