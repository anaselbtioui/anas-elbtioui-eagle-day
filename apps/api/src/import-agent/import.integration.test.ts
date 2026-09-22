import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app.ts'
import { emptyDb, type Db } from '../store.ts'
import type { AuthUser } from '@labas/domain/auth.ts'
import { seedDeskDb } from '../core.ts'

describe('broker browser import fixture API', () => {
  let db: Db
  const prevMode = process.env.LABAS_IMPORT_MODE

  beforeEach(() => {
    process.env.LABAS_IMPORT_MODE = 'fixture'
    db = seedDeskDb(emptyDb())
  })

  afterEach(() => {
    if (prevMode === undefined) delete process.env.LABAS_IMPORT_MODE
    else process.env.LABAS_IMPORT_MODE = prevMode
  })

  async function brokerToken(app: ReturnType<typeof createApp>): Promise<string> {
    const res = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'broker',
        email: `broker.import.${Date.now()}@labas.test`,
        password: 'test-pass-12',
        displayName: 'Salma',
      }),
    })
    expect([200, 201]).toContain(res.status)
    const body = (await res.json()) as { token: string; user: AuthUser }
    return body.token
  }

  it('runs new fixture → confirm → queue has imported dossier', async () => {
    const app = createApp(
      async () => db,
      async (next) => {
        db = next
      },
    )
    const token = await brokerToken(app)
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const start = await app.request('/api/broker/import/sessions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ source: 'TRT', consent: true, fixtureOutcome: 'new' }),
    })
    expect(start.status).toBe(201)
    const { sessionId } = (await start.json()) as { sessionId: string }

    let session = (await (
      await app.request(`/api/broker/import/sessions/${sessionId}`, { headers: auth })
    ).json()) as { status: string }
    for (let i = 0; i < 40 && session.status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 100))
      session = (await (
        await app.request(`/api/broker/import/sessions/${sessionId}`, { headers: auth })
      ).json()) as { status: string }
    }
    expect(session.status).toBe('await_confirm')

    const confirm = await app.request(`/api/broker/import/sessions/${sessionId}/confirm`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({}),
    })
    expect(confirm.status).toBe(200)
    const confirmed = (await confirm.json()) as {
      created: boolean
      bundle: { dossierId: string; profile: { policy: { number: string | null } } }
    }
    expect(confirmed.created).toBe(true)
    expect(confirmed.bundle.profile.policy.number).toBe('MA-AUTO-25001')

    const queue = (await (
      await app.request('/api/broker/queue', { headers: auth })
    ).json()) as { dossierId: string }[]
    expect(queue.some((b) => b.dossierId === confirmed.bundle.dossierId)).toBe(true)
  })

  it('blocks confirm on duplicate fixture', async () => {
    const app = createApp(
      async () => db,
      async (next) => {
        db = next
      },
    )
    const token = await brokerToken(app)
    const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    const start = await app.request('/api/broker/import/sessions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        source: 'OuiAssur',
        consent: true,
        fixtureOutcome: 'duplicate',
      }),
    })
    const { sessionId } = (await start.json()) as { sessionId: string }
    let session = (await (
      await app.request(`/api/broker/import/sessions/${sessionId}`, { headers: auth })
    ).json()) as { status: string; classification: { outcome: string } | null }
    for (let i = 0; i < 40 && session.status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 100))
      session = (await (
        await app.request(`/api/broker/import/sessions/${sessionId}`, { headers: auth })
      ).json()) as typeof session
    }
    expect(session.classification?.outcome).toBe('duplicate')
    const confirm = await app.request(`/api/broker/import/sessions/${sessionId}/confirm`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({}),
    })
    expect(confirm.status).toBe(409)
  })
})
