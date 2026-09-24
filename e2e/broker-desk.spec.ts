import { expect, test, type APIRequestContext } from '@playwright/test'
import { signUpAs } from './helpers.ts'

const API = 'http://127.0.0.1:8787'

type AuthSession = {
  token: string
  user: { brokerId: string | null; motoristId: string | null; policyId: string | null }
}

/** Broker + motorist linked via policy.brokerId → declared dossier. */
async function createDeclaredDossier(
  request: APIRequestContext,
  opts: { name: string; city?: string; narrative?: string; missingConstat?: boolean },
): Promise<{ dossierId: string; brokerEmail: string; brokerToken: string }> {
  const brokerEmail = `broker.${Date.now()}.${Math.random().toString(16).slice(2)}@labas.test`
  const brokerSignup = await request.post(`${API}/api/auth/signup`, {
    data: {
      role: 'broker',
      email: brokerEmail,
      password: 'test-pass-12',
      displayName: 'Salma Courtier',
    },
  })
  expect(brokerSignup.ok(), await brokerSignup.text()).toBeTruthy()
  const brokerSession = (await brokerSignup.json()) as AuthSession
  expect(brokerSession.user.brokerId).toBeTruthy()

  const motoristEmail = `motorist.${Date.now()}.${Math.random().toString(16).slice(2)}@labas.test`
  const signup = await request.post(`${API}/api/auth/signup`, {
    data: {
      role: 'motorist',
      email: motoristEmail,
      password: 'test-pass-12',
      displayName: opts.name,
    },
  })
  expect(signup.ok(), await signup.text()).toBeTruthy()
  const { token, user } = (await signup.json()) as AuthSession & {
    user: { motoristId: string; vehicleId: string; insurerId: string; policyId: string }
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const profileRes = await request.put(`${API}/api/profile`, {
    headers,
    data: {
      motorist: {
        id: user.motoristId,
        name: opts.name,
        firstName: null,
        lastName: null,
        phone: '+212612345678',
        alsoTellEmployerIfCommute: false,
        cin: null,
        city: opts.city ?? 'Casablanca',
        licenseNumber: null,
        licensePhotoPath: null,
        carteGrisePhotoPath: null,
        attestationPhotoPath: null,
      avatarPhotoPath: null,
        assistanceNumber: null,
        brokerPhone: null,
        onboardingStep: 0,
        updatedAt: null,
        brokerAutoAssignedAt: null,
        brokerAutoAssignedAckAt: null,
      },
      vehicle: { id: user.vehicleId, plate: '12345-A-6', makeModel: 'Dacia' },
      insurer: { id: user.insurerId, displayName: 'Wafa' },
      broker: {
        id: brokerSession.user.brokerId,
        displayName: 'Salma Courtier',
      },
      policy: {
        id: user.policyId,
        number: 'POL-E2E-1',
        insurerId: user.insurerId,
        brokerId: brokerSession.user.brokerId,
        vehicleId: user.vehicleId,
        assistanceOnContract: 'unknown',
        attestationValidUntil: null,
      },
    },
  })
  expect(profileRes.ok(), await profileRes.text()).toBeTruthy()

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
  return {
    dossierId: submitted.dossier.id,
    brokerEmail,
    brokerToken: brokerSession.token,
  }
}

async function signInBroker(page: import('@playwright/test').Page, email: string) {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/')
  await page.getByTestId('role-broker').click()
  await page.getByTestId('auth-mode-signin').click()
  await page.locator('#auth-email').fill(email)
  await page.locator('#auth-password').fill('test-pass-12')
  await page.getByTestId('auth-submit').click()
  await page.waitForURL(/\/desk/, { timeout: 15_000 })
}

test('broker desk: queue shows declared dossier + gaps', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { dossierId, brokerEmail } = await createDeclaredDossier(request, {
    name: 'Nadia El Mansouri',
    narrative: 'Collision légère',
    missingConstat: false,
  })

  await signInBroker(page, brokerEmail)
  await expect(page.getByRole('heading', { name: /^Dossiers$/i })).toBeVisible()
  await expect(page.getByTestId('nav-desk-queue')).toBeVisible()
  await expect(page.getByTestId('nav-desk-clients')).toBeVisible()
  await expect(page.getByTestId('nav-desk-import')).toBeVisible()
  const row = page.getByTestId(`dossier-${dossierId}`)
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.click()
  await expect(page.getByTestId('dossier-status')).toBeVisible()
  await expect(page.getByTestId('pieces-section')).toBeVisible()
})

test('broker desk: request piece and human-gated draft', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { dossierId, brokerEmail } = await createDeclaredDossier(request, {
    name: 'Youssef Client',
    narrative: 'Collision desk draft',
  })

  await signInBroker(page, brokerEmail)
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
  await page.getByTestId('submit-draft').click()
  const draftRes = await draftWait
  expect(draftRes.ok(), await draftRes.text()).toBeTruthy()
})
