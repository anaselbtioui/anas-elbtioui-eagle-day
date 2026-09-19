import { expect, test } from '@playwright/test'
import { fillOnboardingEssentials, signUpAs } from './helpers.ts'

const API = 'http://127.0.0.1:8787'

test('LATER send → desk queue shows same dossier id', async ({ page, request, browser }) => {
  test.setTimeout(90_000)

  const brokerCtx = await browser.newContext({
    ...test.info().project.use,
    serviceWorkers: 'block',
    storageState: undefined,
  })
  const brokerPage = await brokerCtx.newPage()
  await signUpAs(brokerPage, 'broker', 'Salma Desk')
  await expect(brokerPage.getByRole('heading', { name: /^Dossiers$/i })).toBeVisible()

  await signUpAs(page, 'motorist', 'Karim Bennani')
  await page.goto('/onboarding')
  await fillOnboardingEssentials(page, {
    name: 'Karim Bennani',
    plate: '88888-B-06',
    insurer: 'Wafa Assurance',
    policy: 'POL-E2E-1',
  })
  await expect(page.getByRole('link', { name: /Je viens d/i })).toBeVisible({ timeout: 15_000 })

  const token = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('labas-session-v3')
      if (!raw) return null
      const parsed = JSON.parse(raw) as { state?: { token?: string | null } }
      return parsed.state?.token ?? null
    } catch {
      return null
    }
  })
  expect(token).toBeTruthy()
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const packRes = await request.post(`${API}/api/packs`, {
    headers,
    data: { city: 'Casablanca', injury: 'no' },
  })
  expect(packRes.ok()).toBeTruthy()
  const pack = (await packRes.json()) as { incident: { id: string } }

  const piecesRes = await request.post(`${API}/api/packs/${pack.incident.id}/pieces`, {
    headers,
    data: { constat: 'complete' },
  })
  expect(piecesRes.ok()).toBeTruthy()

  await request.put(`${API}/api/declarations/${pack.incident.id}`, {
    headers,
    data: { narrative: 'Collision e2e', channel: 'broker' },
  })
  const submitRes = await request.post(`${API}/api/declarations/${pack.incident.id}/submit`, {
    headers,
  })
  expect(submitRes.ok(), await submitRes.text()).toBeTruthy()
  const submitted = (await submitRes.json()) as { dossier: { id: string } }
  const dossierId = submitted.dossier.id
  expect(dossierId).toBeTruthy()

  await page.goto('/later')
  await expect(page.getByTestId('later-tracking')).toBeVisible({ timeout: 15_000 })

  await brokerPage.goto('/desk')
  await expect(brokerPage.getByTestId(`dossier-${dossierId}`)).toBeVisible({ timeout: 15_000 })
  await brokerPage.getByTestId(`dossier-${dossierId}`).click()
  await expect(brokerPage.getByTestId('dossier-status')).toBeVisible()
  await brokerCtx.close()
})
