import { expect, test } from '@playwright/test'

test.describe('i18n locale', () => {
  test('?lng=en switches UI to English', async ({ page }) => {
    await page.goto('/?lng=en')
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.goto('/?lng=en')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByTestId('role-motorist')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('role-motorist')).toContainText(/Motorist/i)
    await expect(page.getByTestId('role-broker')).toContainText(/Broker/i)
  })
})
