import type { Page } from '@playwright/test'

async function resetBrowser(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.()
      if (regs) await Promise.all(regs.map((r) => r.unregister()))
    } catch {
      /* ignore */
    }
    try {
      const keys = await caches?.keys?.()
      if (keys) await Promise.all(keys.map((k) => caches.delete(k)))
    } catch {
      /* ignore */
    }
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/')
}

export async function signUpAs(
  page: Page,
  role: 'motorist' | 'broker',
  name: string,
): Promise<string> {
  const email = `${role}.${Date.now()}.${Math.random().toString(16).slice(2)}@labas.test`
  const parts = name.trim().split(/\s+/)
  const firstName = parts[0] ?? name
  const lastName = parts.slice(1).join(' ') || 'Test'

  await resetBrowser(page)
  await page.getByTestId(`role-${role}`).click()
  await page.locator('#auth-first-name').waitFor({ state: 'visible' })
  await page.locator('#auth-first-name').fill(firstName)
  await page.locator('#auth-last-name').fill(lastName)
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill('test-pass-12')
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/auth/signup') && r.request().method() === 'POST',
      { timeout: 30_000 },
    ),
    page.getByTestId('auth-submit').click(),
  ])
  if (!res.ok()) {
    throw new Error(`signup_failed_${res.status()}: ${await res.text()}`)
  }
  if (role === 'broker') {
    await page.waitForURL(/\/desk/, { timeout: 15_000 })
  } else {
    await page.waitForURL(/\/onboarding|\/$/, { timeout: 15_000 })
  }
  return email
}

/** Phase 1 quick path — skip OTP/photos/broker/assistance; finish Entrer dans Med Assurance. */
export async function fillOnboardingEssentials(
  page: Page,
  opts: { name: string; plate: string; insurer: string; policy?: string },
): Promise<void> {
  const alreadyInFlow = await page
    .getByText(/Bienvenue|Téléphone|Identité|Permis|Carte grise|Attestation/i)
    .first()
    .isVisible()
    .catch(() => false)
  if (!alreadyInFlow) {
    await page.getByRole('button', { name: /Remplir mon profil/i }).click()
  }

  // welcome → Continuer
  await page.getByRole('button', { name: /Continuer/i }).click()
  // otp → Passer
  await page.getByRole('button', { name: /Passer/i }).click()
  // identity
  const parts = opts.name.trim().split(/\s+/)
  await page.getByLabel(/^Prénom$/i).fill(parts[0] ?? opts.name)
  await page.getByLabel(/^Nom$/i).fill(parts.slice(1).join(' ') || 'Test')
  await page.getByRole('button', { name: /Continuer/i }).click()
  // permis → Passer
  await page.getByRole('button', { name: /Passer/i }).click()
  // carte grise
  await page.getByLabel(/Immatriculation/i).fill(opts.plate)
  await page.getByRole('button', { name: /Continuer/i }).click()
  // attestation
  await page.getByLabel(/^Assureur/i).fill(opts.insurer)
  if (opts.policy) {
    await page.getByLabel(/Numéro de contrat/i).fill(opts.policy)
  }
  await page.getByRole('button', { name: /Continuer/i }).click()
  // broker → Passer
  await page.getByRole('button', { name: /Passer/i }).click()
  // assistance → Passer
  await page.getByRole('button', { name: /Passer/i }).click()
  // review → Continuer
  await page.getByRole('button', { name: /Continuer/i }).click()
  // done
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 30_000 }),
    page.getByRole('button', { name: /Entrer dans/i }).click(),
  ])
}
