import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { fillOnboardingEssentials, signUpAs } from './helpers.ts'

const shotDir = path.resolve('docs/screenshots')
const API = 'http://127.0.0.1:8787'

test.beforeAll(() => {
  fs.mkdirSync(shotDir, { recursive: true })
})

test('capture motorist + desk screenshots', async ({ page, request, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')
  await page.screenshot({ path: path.join(shotDir, '00-role-picker.png'), fullPage: true })

  // Broker account first so onboarding can associate the motorist.
  const desk = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  })
  const deskPage = await desk.newPage()
  await signUpAs(deskPage, 'broker', 'Salma Desk')
  await expect(deskPage.getByRole('heading', { name: /^Dossiers$/i })).toBeVisible()

  const email = await signUpAs(page, 'motorist', 'Amine Alaoui')
  await page.goto('/onboarding')
  await page.screenshot({ path: path.join(shotDir, '01-onboarding.png'), fullPage: true })

  await fillOnboardingEssentials(page, {
    name: 'Amine Alaoui',
    plate: '12345-A-16',
    insurer: 'Assureur test',
  })
  await page.screenshot({ path: path.join(shotDir, '02-home-three-doors.png'), fullPage: true })

  await page.getByRole('link', { name: /Je viens d/i }).click()
  await page.getByRole('button', { name: /Je viens d/i }).click()
  await page.screenshot({ path: path.join(shotDir, '03-now-safety.png'), fullPage: true })

  await page.getByText(/Une personne est blessée/i).click()
  await page.screenshot({ path: path.join(shotDir, '04-stop-injury.png'), fullPage: true })
  await expect(page.getByRole('heading', { name: /Appelez les autorités/i })).toBeVisible()

  const signin = await request.post(`${API}/api/auth/signin`, {
    data: { email, password: 'test-pass-12' },
  })
  const { token } = (await signin.json()) as { token: string }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  const packRes = await request.post(`${API}/api/packs`, {
    headers,
    data: { city: 'Casablanca', injury: 'no' },
  })
  const pack = (await packRes.json()) as { incident: { id: string } }
  await request.post(`${API}/api/packs/${pack.incident.id}/pieces`, {
    headers,
    data: { constat: 'complete' },
  })

  await page.goto('/later')
  await expect(page.getByTestId('later-pieces')).toBeVisible()
  await page.screenshot({ path: path.join(shotDir, '05-later-gap.png'), fullPage: true })
  await page.getByTestId('later-to-review').click()
  await page.getByTestId('later-confirm').check()
  await page.screenshot({ path: path.join(shotDir, '06-later-review.png'), fullPage: true })
  await page.getByTestId('later-submit').click()
  await expect(page.getByTestId('later-tracking')).toBeVisible()
  await page.screenshot({ path: path.join(shotDir, '07-later-tracking.png'), fullPage: true })

  const tracking = await request.get(`${API}/api/dossiers?incidentId=${pack.incident.id}`, {
    headers,
  })
  expect(tracking.ok()).toBeTruthy()
  const dossier = (await tracking.json()) as { id: string }
  const dossierId = dossier.id
  expect(dossierId).toBeTruthy()

  await deskPage.goto('/desk')
  await expect(deskPage.getByRole('heading', { name: /^Dossiers$/i })).toBeVisible()
  const row = deskPage.getByTestId(`dossier-${dossierId}`)
  await expect(row).toBeVisible({ timeout: 15_000 })
  await deskPage.screenshot({ path: path.join(shotDir, '08-desk-queue.png'), fullPage: true })
  await row.click()
  await expect(deskPage.getByTestId('pieces-section')).toBeVisible()
  await deskPage.screenshot({ path: path.join(shotDir, '09-desk-fiche.png'), fullPage: true })
  await deskPage.getByTestId('open-draft').click()
  await expect(deskPage.getByTestId('human-approve')).toBeVisible()
  await deskPage.screenshot({ path: path.join(shotDir, '10-desk-draft.png'), fullPage: true })
  await desk.close()
})
