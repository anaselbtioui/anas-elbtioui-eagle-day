import { expect, test, type Browser, type Page } from '@playwright/test'
import { signUpAs } from './helpers.ts'

/** Prefer English copy for stable selectors. */
async function useEnglish(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en')
  })
  const url = new URL(page.url() || 'http://127.0.0.1:5173/')
  url.searchParams.set('lng', 'en')
  await page.goto(url.pathname + '?' + url.searchParams.toString())
}

function continueBtn(page: Page) {
  return page.getByRole('button', { name: /^(Continue|Continuer)$/i })
}

function backBtn(page: Page) {
  return page.getByRole('button', { name: /^(Back|Retour)$/i })
}

function skipStep(page: Page) {
  return page.getByTestId('onboarding-skip-step')
}

function skipAll(page: Page) {
  return page.getByTestId('onboarding-skip-all')
}

/** Mobile onboarding lands on hero — open the sheet wizard. */
async function openOnboardingWizard(page: Page): Promise<void> {
  const open = page.getByRole('button', { name: /^(Fill my profile|Remplir mon profil)$/i })
  if (await open.isVisible().catch(() => false)) {
    await open.click()
  }
  await expect(continueBtn(page)).toBeVisible({ timeout: 10_000 })
}

async function setAttestationDate(page: Page, iso: string): Promise<void> {
  // data-testid is on the wrapper; click the trigger button inside.
  const trigger = page.getByTestId('attestation-valid-until').getByRole('button')
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click({ force: true })
  const panel = page.locator('[data-testid="date-picker-panel"]')
  await expect(panel).toBeVisible({ timeout: 10_000 })
  await expect(panel.locator('button[data-iso]').first()).toBeAttached({ timeout: 5_000 })

  const dayBtn = () => panel.locator(`button[data-iso="${iso}"]`)
  const next = panel.getByLabel(/^(Next month|Mois suivant)$/i)
  const prev = panel.getByLabel(/^(Previous month|Mois précédent)$/i)
  const target = new Date(`${iso}T12:00:00`).getTime()

  for (let i = 0; i < 36; i++) {
    if ((await dayBtn().count()) > 0) break
    const mid = panel.locator('button[data-iso]').nth(15)
    const sampleIso = await mid.getAttribute('data-iso')
    if (!sampleIso) break
    const sampleMs = new Date(`${sampleIso}T12:00:00`).getTime()
    // DOM click — Playwright force click was dismissing the portaled panel.
    await (target >= sampleMs ? next : prev).evaluate((el) => (el as HTMLButtonElement).click())
    await expect(panel.locator('button[data-iso]').first()).toBeAttached({ timeout: 3_000 })
  }
  await expect(dayBtn()).toBeAttached({ timeout: 5_000 })
  await dayBtn().evaluate((el) => (el as HTMLButtonElement).click())
  await expect(panel).toBeHidden({ timeout: 5_000 })
}

function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function pickAnyBroker(page: Page): Promise<void> {
  const list = page.getByTestId('broker-pick-list')
  await expect(list).toBeVisible({ timeout: 15_000 })
  const first = page.locator('[data-testid^="broker-pick-"]').first()
  await expect(first).toBeVisible({ timeout: 15_000 })
  await first.click()
  await expect(continueBtn(page)).toBeEnabled({ timeout: 10_000 })
}

async function fillCity(page: Page, city: string): Promise<void> {
  const input = page.getByLabel(/^(City|Ville)$/i)
  await input.click()
  await input.fill(city)
  const option = page.getByRole('option', { name: new RegExp(`^${city}$`, 'i') }).first()
  await expect(option).toBeVisible()
  // List portals above the sheet; normal click is intercepted by the dialog panel.
  await option.click({ force: true })
}

async function fillVehicle(page: Page): Promise<void> {
  await page.getByTestId('vehicle-make').selectOption('Dacia')
  await page.getByTestId('vehicle-model').selectOption('Sandero')
  await page.getByTestId('vehicle-year').selectOption('2022')
}

async function fillPhone(page: Page, national: string): Promise<void> {
  await page.locator('#otp-phone-national').fill(national)
}

async function seedBroker(browser: Browser): Promise<void> {
  const ctx = await browser.newContext({ locale: 'en-US' })
  const page = await ctx.newPage()
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'))
  await signUpAs(page, 'broker', 'Salma Desk')
  await ctx.close()
}

test.describe('wallet flow', () => {
  test.beforeAll(async ({ browser }) => {
    await seedBroker(browser)
  })

  test('onboarding gates: phone, identity, attestation expiry, Back, finish', async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'))
    await signUpAs(page, 'motorist', 'Nadia El Mansouri')
    await expect(page).toHaveURL(/\/onboarding/)
    await useEnglish(page)
    await openOnboardingWizard(page)

    // welcome
    await continueBtn(page).click()

    // phone — invalid blocks Continue
    await fillPhone(page, '12')
    await expect(continueBtn(page)).toBeDisabled()
    await fillPhone(page, '612345678')
    await expect(continueBtn(page)).toBeEnabled()
    await continueBtn(page).click()

    // identity — incomplete until CIN + city
    await expect(continueBtn(page)).toBeDisabled()
    // identity — bad CIN blocks when present
    await page.getByLabel(/^(First name|Prénom)$/i).fill('Nadia')
    await page.getByLabel(/^(Last name|Nom)$/i).fill('El Mansouri')
    await page.getByLabel(/^CIN$/i).fill('XX')
    await fillCity(page, 'Casablanca')
    await expect(continueBtn(page)).toBeDisabled()
    await page.getByLabel(/^CIN$/i).fill('AB123456')
    await expect(continueBtn(page)).toBeEnabled()
    await continueBtn(page).click()

    // permis — empty: Continue off, skip
    await expect(continueBtn(page)).toBeDisabled()
    await skipStep(page).click()

    // carte grise — bad plate blocks
    await page.getByLabel(/^(Plate|Immatriculation)/i).fill('BAD')
    await fillVehicle(page)
    await expect(continueBtn(page)).toBeDisabled()
    await page.getByLabel(/^(Plate|Immatriculation)/i).fill('12345-A-16')
    await expect(continueBtn(page)).toBeEnabled()
    await continueBtn(page).click()

    // Back from attestation → carte grise (still in wizard)
    await expect(page.getByLabel(/^(Insurer|Assureur)/i)).toBeVisible()
    await expect(continueBtn(page)).toBeDisabled()
    await backBtn(page).click()
    await expect(page.getByLabel(/^(Plate|Immatriculation)/i)).toBeVisible()
    await continueBtn(page).click()

    // attestation — optional policy empty OK; past date blocks Continue + Skip
    await page.getByTestId('insurer-select').selectOption('Sanlam Maroc')
    const expiredIso = isoDaysFromNow(-45)
    await setAttestationDate(page, expiredIso)
    await expect(page.getByText(/Attestation expired|Attestation expirée/i)).toBeVisible()
    await expect(continueBtn(page)).toBeDisabled()
    await expect(skipStep(page)).toHaveCount(0)
    await expect(skipAll(page)).toHaveCount(0)

    const validIso = isoDaysFromNow(400)
    await setAttestationDate(page, validIso)
    await expect(continueBtn(page)).toBeEnabled()
    await continueBtn(page).click()

    await pickAnyBroker(page)
    await continueBtn(page).click()

    // assistance → skip
    await skipStep(page).click()

    // review → continue
    await continueBtn(page).click()

    // done → enter home
    await Promise.all([
      page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 30_000 }),
      page.getByRole('button', { name: /^(Enter|Entrer)/i }).click(),
    ])
    await expect(page.getByTestId('wallet-nudge-drawer')).toBeHidden({ timeout: 15_000 })
  })

  test('gap resume: %, focus, Back, reload persist', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'))
    await signUpAs(page, 'motorist', 'Karim Benali')
    await useEnglish(page)
    await page.goto('/onboarding?lng=en')
    await openOnboardingWizard(page)

    await continueBtn(page).click()
    await fillPhone(page, '661234567')
    await continueBtn(page).click()
    await page.getByLabel(/^(First name|Prénom)$/i).fill('Karim')
    await page.getByLabel(/^(Last name|Nom)$/i).fill('Benali')
    await page.getByLabel(/^CIN$/i).fill('CD987654')
    await fillCity(page, 'Rabat')
    await continueBtn(page).click()
    // leave permis / carte / attestation empty — skip-all to review, but pick broker first
    await skipStep(page).click() // permis
    await skipStep(page).click() // carte
    await skipStep(page).click() // attestation (empty date OK)
    await pickAnyBroker(page)
    await continueBtn(page).click() // broker
    await skipStep(page).click() // assistance
    await continueBtn(page).click() // review
    const enter = page.getByRole('button', { name: /^(Enter|Entrer)/i })
    await expect(enter).toBeVisible()
    await enter.click()
    await expect(page.getByTestId('wallet-nudge-drawer').or(page.getByRole('link', { name: /NOW|Je viens/i }))).toBeVisible({
      timeout: 30_000,
    })
    await expect(page).not.toHaveURL(/onboarding/)

    const nudge = page.getByTestId('wallet-nudge-drawer')
    await expect(nudge).toBeVisible({ timeout: 20_000 })
    const title = nudge.locator('#wallet-nudge-title')
    await expect(title).toContainText(/% (left|restant)/i)
    const pctMatch = (await title.textContent())?.match(/(\d+)\s*%/)
    expect(pctMatch).toBeTruthy()
    const remaining = Number(pctMatch![1])
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThan(100)

    await page.getByTestId('wallet-nudge-reopen').click()
    await expect(page.getByTestId('onboarding-wizard-body')).toBeVisible()
    const headerBar = page.getByTestId('wallet-nudge-header-progress')
    await expect(headerBar).toBeVisible()
    const style = await headerBar.locator('div').first().getAttribute('style')
    expect(style).toContain(`translateX(-${remaining}%)`)

    // First keystroke must not steal focus (old remount-on-% bug).
    const editable = page.locator('input:not([type="hidden"]), textarea').first()
    await editable.click()
    await page.keyboard.type('Z')
    const tag = await page.evaluate(() => document.activeElement?.tagName)
    expect(tag).toBe('INPUT')
    const typed = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.value ?? '')
    expect(typed).toContain('Z')
    await page.keyboard.type('Y')
    const typed2 = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.value ?? '')
    expect(typed2).toContain('Y')

    if (await continueBtn(page).isEnabled()) {
      await continueBtn(page).click()
      await expect(nudge).toBeVisible()
      await backBtn(page).click()
      await expect(nudge).toBeVisible()
      await expect(page.getByTestId('onboarding-wizard-body')).toBeVisible()
    }

    await page.waitForTimeout(600)
    await page.reload()
    await useEnglish(page)
    await expect(nudge).toBeVisible({ timeout: 20_000 })
    const after = (await title.textContent()) ?? ''
    expect(after).toMatch(/\d+\s*%/)
    // Auth-seed flash used to show ~73% then jump — settle must not be that alone if gaps remain many
    expect(after).not.toMatch(/^73\s*%/)

    await page.getByTestId('wallet-nudge-reopen').click().catch(() => undefined)
    await expect(page.getByTestId('onboarding-wizard-body')).toBeVisible()
    // Mid-gap Back stays inside the drawer.
    if (await continueBtn(page).isEnabled()) {
      await continueBtn(page).click()
    }
    await backBtn(page).click()
    await expect(page.getByTestId('onboarding-wizard-body')).toBeVisible()
    // Close control collapses the resume drawer (first-gap Back also calls onLeave).
    await page
      .getByTestId('wallet-nudge-drawer')
      .getByRole('button', { name: /close/i })
      .click({ force: true })
    await expect(page.getByTestId('onboarding-wizard-body')).toBeHidden({ timeout: 5_000 })
  })
})
