import { expect, test } from '@playwright/test'
import { fillOnboardingEssentials, signUpAs } from './helpers.ts'

test('NOW door: injury stop and happy path entry', async ({ page }) => {
  await signUpAs(page, 'motorist', 'Amine Alaoui')
  await page.goto('/onboarding')
  await fillOnboardingEssentials(page, {
    name: 'Amine Alaoui',
    plate: '12345-A-16',
    insurer: 'Assureur test',
  })

  await expect(page.getByRole('link', { name: /Je viens d/i })).toBeVisible({ timeout: 15_000 })

  await page.getByRole('link', { name: /Je viens d/i }).click()
  await page.getByRole('button', { name: /Je viens d/i }).click()

  await expect(page.getByText(/Une personne est blessée/i)).toBeVisible()
  await page.getByText(/Une personne est blessée/i).click()
  await expect(page.getByRole('heading', { name: /Appelez les autorités/i })).toBeVisible()
  await expect(page.getByRole('link', { name: /Appeler le 19/i })).toBeVisible()
})
