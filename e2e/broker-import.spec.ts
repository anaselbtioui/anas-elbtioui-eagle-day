import { expect, test } from '@playwright/test'
import { signUpAs } from './helpers.ts'

test('broker import: new fixture merges into desk', async ({ page }) => {
  test.setTimeout(60_000)
  await signUpAs(page, 'broker', 'Salma Import')
  await page.goto('/desk/import')
  await expect(page.getByTestId('import-mode-badge')).toBeVisible()
  await page.getByTestId('import-source-TRT').click()
  await page.getByTestId('import-outcome-new').click()
  await page.getByTestId('import-consent').check()
  await page.getByTestId('import-run').click()
  await expect(page.getByTestId('import-mapping')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('import-confirm').click()
  await expect(page.getByTestId('import-confirmed')).toBeVisible({ timeout: 15_000 })
  await page.getByTestId('import-confirmed').getByRole('link').click()
  await expect(page).toHaveURL(/\/desk\/DOS-IMP-/)
})
