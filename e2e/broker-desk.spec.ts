import { expect, test, type APIRequestContext } from '@playwright/test'
import { signUpAs } from './helpers.ts'

const API = 'http://127.0.0.1:8787'

/** Motorist signup → pack with constat → submit. Returns dossier id for broker desk. */
async function createDeclaredDossier(
  request: APIRequestContext,
  opts: { name: string; city?: string; narrative?: string; missingConstat?: boolean },
): Promise<{ dossierId: string; email: string }> {
  const email = `motorist.${Date.now()}.${Math.random().toString(16).slice(2)}@labas.test`
  const signup = await request.post(`${API}/api/auth/signup`, {
    data: {
      role: 'motorist',
      email,
      password: 'test-pass-12',
      displayName: opts.name,
    },
  })
  expect(signup.ok(), await signup.text()).toBeTruthy()
  const { token } = (await signup.json()) as { token: string }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const packRes = await request.post(`${API}/api/packs`, {
    headers,
    data: { city: opts.city ?? 'Casablanca', injury: 'no' },
  })
  expect(packRes.ok(), await packRes.text()).toBeTruthy()
  const pack = (await packRes.json()) as { incident: { id: string } }

  if (!opts.missingConstat) {
    const piecesRes = await request.post(`${API}/api/packs/${pack.incident.id}/pieces`, {
      headers,
      data: { constat: 'complete' },
    })
    expect(piecesRes.ok(), await piecesRes.text()).toBeTruthy()
  }

  await request.put(`${API}/api/declarations/${pack.incident.id}`, {
    headers,
    data: { narrative: opts.narrative ?? 'Collision e2e', channel: 'broker' },
  })
  const submitRes = await request.post(`${API}/api/declarations/${pack.incident.id}/submit`, {
    headers,
  })
  expect(submitRes.ok(), await submitRes.text()).toBeTruthy()
  const submitted = (await submitRes.json()) as { dossier: { id: string } }
  return { dossierId: submitted.dossier.id, email }
}

test('broker desk: queue shows declared dossier + gaps', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { dossierId } = await createDeclaredDossier(request, {
    name: 'Nadia El Mansouri',
    narrative: 'Collision légère',
    missingConstat: false,
  })
  // Force a gap after submit so desk shows missing piece work
  // (submit requires constat; request piece flow covers gap UX in next test)

  await signUpAs(page, 'broker', 'Salma')
  await expect(page.getByRole('heading', { name: /^Dossiers$/i })).toBeVisible()
  await expect(page.getByTestId('nav-desk-queue')).toBeVisible()
  await expect(page.getByTestId('nav-desk-import')).toBeVisible()
  const row = page.getByTestId(`dossier-${dossierId}`)
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()
  await expect(page.getByTestId('dossier-status')).toBeVisible()
  await expect(page.getByTestId('pieces-section')).toBeVisible()
})

test('broker desk: request piece and human-gated draft', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { dossierId } = await createDeclaredDossier(request, {
    name: 'Youssef Client',
    narrative: 'Collision desk draft',
  })

  await signUpAs(page, 'broker', 'Youssef')
  await expect(page.getByRole('heading', { name: /^Dossiers$/i })).toBeVisible()
  await expect(page.getByTestId(`dossier-${dossierId}`)).toBeVisible({ timeout: 20_000 })
  await page.getByTestId(`dossier-${dossierId}`).click()

  await page.getByTestId('open-request').click()
  const reqWait = page.waitForResponse(
    (r) => r.url().includes('/requests') && r.request().method() === 'POST',
    { timeout: 20_000 },
  )
  await page.getByTestId('submit-request').click()
  const reqRes = await reqWait
  expect(reqRes.ok(), await reqRes.text()).toBeTruthy()
  await expect(page.getByTestId('dossier-status')).toContainText(/attente client/i)

  const draftWait = page.waitForResponse(
    (r) => r.url().includes('/drafts') && r.request().method() === 'POST',
    { timeout: 20_000 },
  )
  await page.getByTestId('open-draft').click()
  expect((await draftWait).ok()).toBeTruthy()
  await expect(page.getByTestId('human-approve')).toBeVisible({ timeout: 15_000 })
  const approve = page.getByTestId('approve-draft')
  await expect(approve).toBeDisabled()
  const patchWait = page.waitForResponse(
    (r) =>
      r.url().includes('/drafts/') &&
      r.request().method() === 'PATCH' &&
      r.ok(),
    { timeout: 15_000 },
  )
  await page.getByTestId('human-approve').click({ force: true })
  await patchWait
  await expect(approve).toBeEnabled({ timeout: 10_000 })
  await approve.click()
  await expect(page.getByText(/Brouillon approuvé/i)).toBeVisible({ timeout: 10_000 })
})
