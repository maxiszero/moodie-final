import { expect, test } from '@playwright/test'
import { openAuthedFeed, publishPost, skipOnboardingModals } from './helpers'

test.beforeEach(async ({ page }) => {
  await skipOnboardingModals(page)
})

test('register, publish post, see it in feed', async ({ page, request }) => {
  const suffix = Date.now().toString(36)
  const postText = `e2e happy path ${suffix} feeling calm today`

  await openAuthedFeed(page, request, 'e2e_happy')
  await publishPost(page, postText)

  await expect(page.locator('#feedContainer .post-card .post-content', { hasText: postText })).toBeVisible({
    timeout: 30_000,
  })
})
