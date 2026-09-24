import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.ts'
import { profileFromDb, seedDeskDb } from './core.ts'
import { emptyDb, type Db } from './store.ts'
import type { AuthUser } from '@labas/domain/auth.ts'
import { nadiaMissingConstatPack } from '@labas/domain/fixtures.ts'
import { applyEvidenceRules } from '@labas/domain/rules.ts'
import type { EvidencePack } from '@labas/domain/types.ts'
import { stubBroker } from '@labas/domain/types.ts'

function memory() {
  let db: Db = emptyDb()
  const app = createApp(
    async () => db,
    async (next) => {
      db = next
    },
  )
  return {
    app,
    getDb: () => db,
    seedDesk: (brokerId?: string) => {
      db = seedDeskDb(db)
      if (brokerId) {
        db = {
          ...db,
          policies: db.policies.map((p) => ({ ...p, brokerId })),
        }
      }
    },
  }
}

async function linkMotoristToBroker(
  app: ReturnType<typeof createApp>,
  motorist: Awaited<ReturnType<typeof signup>>,
  brokerId: string,
  getDb: () => Db,
) {
  const db = getDb()
  const policy = db.policies.find((p) => p.id === motorist.user.policyId)
  const motoristRow = db.motorists.find((m) => m.id === motorist.user.motoristId)
  const vehicle = policy ? db.vehicles.find((v) => v.id === policy.vehicleId) : null
  const insurer = policy ? db.insurers.find((i) => i.id === policy.insurerId) : null
  const broker = db.brokers.find((b) => b.id === brokerId)
  expect(policy && motoristRow && vehicle && insurer && broker).toBeTruthy()
  const res = await app.request('/api/profile', {
    method: 'PUT',
    headers: motorist.headers,
    body: JSON.stringify({
      motorist: motoristRow,
      vehicle,
      insurer,
      broker,
      policy: { ...policy!, brokerId },
    }),
  })
  expect(res.status).toBe(200)
}

async function signup(
  app: ReturnType<typeof createApp>,
  role: 'motorist' | 'broker',
  displayName: string,
) {
  const res = await app.request('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role,
      email: `${role}.${randomUUID()}@labas.test`,
      password: 'test-pass-12',
      displayName,
    }),
  })
  expect(res.status).toBe(201)
  const body = (await res.json()) as { token: string; user: AuthUser }
  return {
    user: body.user,
    headers: {
      Authorization: `Bearer ${body.token}`,
      'Content-Type': 'application/json',
    },
  }
}

function bindPack(pack: EvidencePack, user: AuthUser): EvidencePack {
  return {
    ...pack,
    incident: {
      ...pack.incident,
      motoristId: user.motoristId!,
      policyId: user.policyId,
    },
  }
}

describe('API auth', () => {
  it('rejects packs without a session', async () => {
    const { app } = memory()
    const res = await app.request('/api/packs')
    expect(res.status).toBe(401)
  })

  it('forbids motorist on broker queue', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Amine Alaoui')
    const res = await app.request('/api/broker/queue', { headers: motorist.headers })
    expect(res.status).toBe(403)
  })

  it('signs in with the same email', async () => {
    const { app } = memory()
    const email = `relogin.${randomUUID()}@labas.test`
    await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'broker',
        email,
        password: 'test-pass-12',
        displayName: 'Salma',
      }),
    })
    const res = await app.request('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-pass-12', role: 'broker' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { role: string; displayName: string } }
    expect(body.user.role).toBe('broker')
    expect(body.user.displayName).toBe('Salma')
  })

  it('rejects a signed JWT after the user row is gone', async () => {
    const { app, getDb } = memory()
    const motorist = await signup(app, 'motorist', 'Ghost Token')
    const db = getDb()
    db.users = db.users.filter((u) => u.id !== motorist.user.id)
    const me = await app.request('/api/auth/me', { headers: motorist.headers })
    expect(me.status).toBe(401)
    const refresh = await app.request('/api/auth/refresh', {
      method: 'POST',
      headers: motorist.headers,
      body: '{}',
    })
    expect(refresh.status).toBe(401)
  })

  it('soft-deletes account and frees email for re-signup', async () => {
    const { app, getDb } = memory()
    const email = `delete-me.${randomUUID()}@labas.test`
    const signupRes = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'motorist',
        email,
        password: 'test-pass-12',
        displayName: 'Delete Me',
      }),
    })
    expect(signupRes.status).toBe(201)
    const session = (await signupRes.json()) as { token: string; user: { id: string } }
    const headers = { Authorization: `Bearer ${session.token}` }

    const del = await app.request('/api/auth/delete-account', {
      method: 'POST',
      headers,
      body: '{}',
    })
    expect(del.status).toBe(200)

    const row = getDb().users.find((u) => u.id === session.user.id)
    expect(row?.deletedAt).toBeTruthy()

    const me = await app.request('/api/auth/me', { headers })
    expect(me.status).toBe(401)

    const signin = await app.request('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-pass-12' }),
    })
    expect(signin.status).toBe(401)

    const again = await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'motorist',
        email,
        password: 'test-pass-12',
        displayName: 'Delete Me Again',
      }),
    })
    expect(again.status).toBe(201)
  })

  it('sign-in ignores entry role and returns the account space', async () => {
    const { app } = memory()
    const email = `mismatch.${randomUUID()}@labas.test`
    await app.request('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'motorist',
        email,
        password: 'test-pass-12',
        displayName: 'Karim Test',
      }),
    })
    const res = await app.request('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'test-pass-12', role: 'broker' }),
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { user: { role: string } }
    expect(body.user.role).toBe('motorist')
  })
})

describe('API profile writes', () => {
  it('resolves each motorist to their own policy', async () => {
    const { app, getDb } = memory()
    const first = await signup(app, 'motorist', 'First Motorist')
    const second = await signup(app, 'motorist', 'Second Motorist')
    const db = getDb()
    expect(profileFromDb(db, first.user.motoristId!)?.policy.id).toBe(first.user.policyId)
    expect(profileFromDb(db, second.user.motoristId!)?.policy.id).toBe(second.user.policyId)
  })

  it('accepts the same updatedAt instant in +00:00 form', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Stamp Motorist')
    const first = await app.request('/api/profile', { headers: motorist.headers })
    const profile = await first.json()
    const saved = await (
      await app.request('/api/profile', {
        method: 'PUT',
        headers: motorist.headers,
        body: JSON.stringify(profile),
      })
    ).json()
    const pgStamp = String(saved.motorist.updatedAt).replace('Z', '+00:00')
    const res = await app.request('/api/profile', {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({ ...saved, motorist: { ...saved.motorist, updatedAt: pgStamp } }),
    })
    expect(res.status).toBe(200)
  })
})

describe('API submit guard', () => {
  it('409 when Nadia has no constat or PV', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    const put = await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    expect(put.status).toBe(200)
    const submit = await app.request(`/api/declarations/${pack.incident.id}/submit`, {
      method: 'POST',
      headers: motorist.headers,
    })
    expect(submit.status).toBe(409)
    const body = (await submit.json()) as { error: string; dossier: { status: string } }
    expect(body.error).toBe('blocked_missing_evidence')
    expect(body.dossier.status).toBe('blocked_missing_evidence')
  })

  it('accepts submit after constat complete', async () => {
    const { app, getDb } = memory()
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    const db = getDb()
    db.policies = db.policies.map((p) =>
      p.id === motorist.user.policyId ? { ...p, number: 'MA-TEST-1' } : p,
    )
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    pack.evidence.constat = 'complete'
    pack.evidence.photos = [
      { photoId: 'p1', slot: 'scene', zoneId: null, label: 'scène', capturedAt: null },
    ]
    await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    const submit = await app.request(`/api/declarations/${pack.incident.id}/submit`, {
      method: 'POST',
      headers: motorist.headers,
    })
    expect(submit.status).toBe(200)
    const body = (await submit.json()) as {
      declaration: { submittedAt: string | null }
      dossier: { status: string }
    }
    expect(body.declaration.submittedAt).toBeTruthy()
    expect(body.dossier.status).toBe('with_broker')
  })
})

describe('API feature coverage', () => {
  it('lists packs and session after create', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Amine Alaoui')
    const created = await app.request('/api/packs', {
      method: 'POST',
      headers: motorist.headers,
      body: JSON.stringify({ vehicleImmobilised: true, city: 'Casablanca' }),
    })
    expect(created.status).toBe(201)
    const pack = (await created.json()) as { incident: { id: string; vehicleImmobilised: boolean } }
    expect(pack.incident.vehicleImmobilised).toBe(true)

    const list = await app.request('/api/packs', { headers: motorist.headers })
    const packs = (await list.json()) as { incident: { id: string } }[]
    expect(packs).toHaveLength(1)
    expect(packs[0].incident.id).toBe(pack.incident.id)

    const session = await app.request('/api/session', { headers: motorist.headers })
    const snap = (await session.json()) as {
      profile: { motorist: { id: string } }
      packs: unknown[]
      files: { incidentId: string; declaration: null }[]
    }
    expect(snap.profile.motorist.id).toBe(motorist.user.motoristId)
    expect(snap.packs).toHaveLength(1)
    expect(snap.files[0].declaration).toBeNull()
  })

  it('PATCH injury yes forces pv required', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Amine Alaoui')
    const created = await app.request('/api/packs', { method: 'POST', headers: motorist.headers })
    const pack = (await created.json()) as { incident: { id: string } }
    const patched = await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PATCH',
      headers: motorist.headers,
      body: JSON.stringify({ incident: { injury: 'yes' } }),
    })
    expect(patched.status).toBe(200)
    const body = (await patched.json()) as { evidence: { pv: string } }
    expect(body.evidence.pv).toBe('required')
  })

  it('PUT cancel keeps pv required when other party is known', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Cancel Keep')
    const created = await app.request('/api/packs', { method: 'POST', headers: motorist.headers })
    const pack = (await created.json()) as EvidencePack
    const otherId = `${pack.incident.id}-O`
    const cancelled: EvidencePack = {
      ...pack,
      incident: { ...pack.incident, injury: 'no', otherPartyId: otherId },
      otherParty: { id: otherId, status: 'known', name: 'Karim', plate: null },
      evidence: { ...pack.evidence, pv: 'required' },
    }
    const saved = await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(cancelled),
    })
    expect(saved.status).toBe(200)
    const body = (await saved.json()) as EvidencePack
    expect(body.evidence.pv).toBe('required')

    const again = await app.request(`/api/packs/${pack.incident.id}`, {
      headers: motorist.headers,
    })
    const reloaded = (await again.json()) as EvidencePack
    expect(reloaded.evidence.pv).toBe('required')
  })

  it('GET file by incident after draft', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    await app.request(`/api/declarations/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({ narrative: 'Collision légère.' }),
    })
    const fileRes = await app.request(`/api/files/${pack.incident.id}`, {
      headers: motorist.headers,
    })
    expect(fileRes.status).toBe(200)
    const file = (await fileRes.json()) as {
      declaration: { narrative: string }
      dossier: { status: string }
    }
    expect(file.declaration.narrative).toBe('Collision légère.')
    expect(file.dossier.status).toBe('blocked_missing_evidence')
  })

  it('adding photos after submit clears waiting_motorist', async () => {
    const { app, getDb } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    await linkMotoristToBroker(app, motorist, broker.user.brokerId!, getDb)
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    pack.evidence.constat = 'complete'
    await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    const submit = await app.request(`/api/declarations/${pack.incident.id}/submit`, {
      method: 'POST',
      headers: motorist.headers,
    })
    const submitted = (await submit.json()) as { dossier: { status: string; missingPieces: string[] } }
    expect(submitted.dossier.status).toBe('waiting_motorist')
    expect(submitted.dossier.missingPieces).toContain('photos')

    const pieces = await app.request(`/api/packs/${pack.incident.id}/pieces`, {
      method: 'POST',
      headers: motorist.headers,
      body: JSON.stringify({
        photos: [{ photoId: 'p1', slot: 'scene', zoneId: null, label: 'scène', capturedAt: null }],
      }),
    })
    expect(pieces.status).toBe(200)
    const file = (await pieces.json()) as { dossier: { status: string; missingPieces: string[] } }
    expect(file.dossier.status).toBe('with_broker')
    expect(file.dossier.missingPieces).not.toContain('photos')

    const queue = await app.request('/api/broker/queue', { headers: broker.headers })
    const items = (await queue.json()) as {
      pack: { incident: { id: string } }
      profile: { motorist: { name: string } }
    }[]
    expect(items).toHaveLength(1)
    expect(items[0].pack.incident.id).toBe(pack.incident.id)
    expect(items[0].profile.motorist.name).toBe('Nadia El Mansouri')
  })
})

describe('API broker desk', () => {
  it('loads fixture dossiers and request sets waiting_motorist', async () => {
    const { app, seedDesk } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    seedDesk(broker.user.brokerId!)
    const queue = await app.request('/api/broker/queue', { headers: broker.headers })
    const bundles = (await queue.json()) as { dossierId: string; dossier: { status: string } }[]
    expect(bundles.map((b) => b.dossierId).sort()).toEqual(['DOS-1', 'DOS-2', 'DOS-3'])

    const nadia = await app.request('/api/broker/dossiers/DOS-1', { headers: broker.headers })
    expect(nadia.status).toBe(200)
    const requested = await app.request('/api/broker/dossiers/DOS-1/requests', {
      method: 'POST',
      headers: broker.headers,
      body: JSON.stringify({ piece: 'constat_or_pv', note: 'Merci de signer le constat.' }),
    })
    expect(requested.status).toBe(201)
    const body = (await requested.json()) as {
      dossier: { status: string }
      requests: unknown[]
    }
    expect(body.dossier.status).toBe('waiting_motorist')
    expect(body.requests).toHaveLength(1)
  })

  it('blocks draft approve without human checkbox then accepts', async () => {
    const { app, seedDesk } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    seedDesk(broker.user.brokerId!)
    const created = await app.request('/api/broker/dossiers/DOS-1/drafts', {
      method: 'POST',
      headers: broker.headers,
      body: JSON.stringify({ intent: 'missing_piece', pieceLabel: 'constat' }),
    })
    const bundle = (await created.json()) as { drafts: { id: string; humanApproved: boolean }[] }
    const draftId = bundle.drafts[0]!.id

    const blocked = await app.request(`/api/broker/dossiers/DOS-1/drafts/${draftId}/approve`, {
      method: 'POST',
      headers: broker.headers,
    })
    expect(blocked.status).toBe(409)
    const blockedBody = (await blocked.json()) as { error: string }
    expect(blockedBody.error).toBe('not_human_approved')

    await app.request(`/api/broker/dossiers/DOS-1/drafts/${draftId}`, {
      method: 'PATCH',
      headers: broker.headers,
      body: JSON.stringify({ humanApproved: true }),
    })
    const ok = await app.request(`/api/broker/dossiers/DOS-1/drafts/${draftId}/approve`, {
      method: 'POST',
      headers: broker.headers,
    })
    expect(ok.status).toBe(200)
    const approved = (await ok.json()) as { drafts: { approvedAt: string | null }[] }
    expect(approved.drafts[0]?.approvedAt).toBeTruthy()
  })

  it('toggles task and refuses handoff on blocked Nadia', async () => {
    const { app, seedDesk } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    seedDesk(broker.user.brokerId!)
    const toggled = await app.request('/api/broker/dossiers/DOS-1/tasks/T-N1/toggle', {
      method: 'POST',
      headers: broker.headers,
    })
    const after = (await toggled.json()) as { tasks: { id: string; done: boolean }[] }
    expect(after.tasks.find((t) => t.id === 'T-N1')?.done).toBe(true)

    const handoff = await app.request('/api/broker/dossiers/DOS-1/handoff', {
      method: 'POST',
      headers: broker.headers,
    })
    expect(handoff.status).toBe(409)

    const omar = await app.request('/api/broker/dossiers/DOS-3/handoff', {
      method: 'POST',
      headers: broker.headers,
    })
    expect(omar.status).toBe(409)
  })

  it('handoff returns 409 has_gaps while pieces missing', async () => {
    const { app, seedDesk } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    seedDesk(broker.user.brokerId!)
    const handoff = await app.request('/api/broker/dossiers/DOS-1/handoff', {
      method: 'POST',
      headers: broker.headers,
    })
    expect(handoff.status).toBe(409)
    const body = (await handoff.json()) as { error: string }
    expect(body.error).toBe('has_gaps')
  })

  it('add-piece flips waiting_motorist to with_broker after submit', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    pack.evidence.constat = 'complete'
    await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    const submit = await app.request(`/api/declarations/${pack.incident.id}/submit`, {
      method: 'POST',
      headers: motorist.headers,
    })
    const submitted = (await submit.json()) as {
      dossier: { status: string; missingPieces: string[] }
    }
    expect(submitted.dossier.status).toBe('waiting_motorist')
    expect(submitted.dossier.missingPieces).toContain('photos')

    const pieces = await app.request(`/api/packs/${pack.incident.id}/pieces`, {
      method: 'POST',
      headers: motorist.headers,
      body: JSON.stringify({
        photos: [{ photoId: 'p1', slot: 'scene', zoneId: null, label: 'scène', capturedAt: null }],
      }),
    })
    expect(pieces.status).toBe(200)
    const file = (await pieces.json()) as { dossier: { status: string; missingPieces: string[] } }
    expect(file.dossier.status).toBe('with_broker')
    expect(file.dossier.missingPieces).not.toContain('photos')
  })

  it('profile PUT syncs app_users.display_name from first/last', async () => {
    const { app, getDb } = memory()
    const motorist = await signup(app, 'motorist', 'Old Signup Name')
    const get = await app.request('/api/profile', { headers: motorist.headers })
    const profile = (await get.json()) as {
      motorist: Record<string, unknown>
      vehicle: Record<string, unknown>
      insurer: Record<string, unknown>
      broker: Record<string, unknown>
      policy: Record<string, unknown>
    }
    const put = await app.request('/api/profile', {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({
        ...profile,
        motorist: {
          ...profile.motorist,
          firstName: 'Anass',
          lastName: 'Bettioui',
        },
        insurer: { ...profile.insurer, displayName: 'Sanlam' },
      }),
    })
    expect(put.status).toBe(200)
    const row = getDb().users.find((u) => u.id === motorist.user.id)
    expect(row?.displayName).toBe('Anass Bettioui')
  })

  it('sole-broker auto-link sets pending until ack', async () => {
    const { app, getDb } = memory()
    const motorist = await signup(app, 'motorist', 'Nadia Auto')
    const broker = await signup(app, 'broker', 'Said Courtier')

    const get = await app.request('/api/profile', { headers: motorist.headers })
    expect(get.status).toBe(200)
    const profile = (await get.json()) as {
      motorist: {
        id: string
        updatedAt: string | null
        brokerAutoAssignedAt: string | null
        brokerAutoAssignedAckAt: string | null
      }
      vehicle: { id: string }
      insurer: { id: string }
      broker: { id: string; displayName: string }
      policy: { id: string; brokerId: string | null }
    }
    expect(profile.policy.brokerId).toBeNull()

    const put = await app.request('/api/profile', {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({
        motorist: profile.motorist,
        vehicle: profile.vehicle,
        insurer: { ...profile.insurer, displayName: 'Sanlam' },
        broker: stubBroker('', ''),
        policy: { ...profile.policy, brokerId: null },
      }),
    })
    expect(put.status).toBe(200)
    const saved = (await put.json()) as typeof profile
    expect(saved.policy.brokerId).toBe(broker.user.brokerId)
    expect(saved.broker.id).toBe(broker.user.brokerId)
    expect(saved.motorist.brokerAutoAssignedAt).toBeTruthy()
    expect(saved.motorist.brokerAutoAssignedAckAt).toBeNull()

    const explicit = await app.request('/api/profile', {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({
        motorist: saved.motorist,
        vehicle: saved.vehicle,
        insurer: saved.insurer,
        broker: saved.broker,
        policy: saved.policy,
      }),
    })
    expect(explicit.status).toBe(200)
    const stillPending = (await explicit.json()) as typeof profile
    expect(stillPending.motorist.brokerAutoAssignedAt).toBeTruthy()
    expect(stillPending.motorist.brokerAutoAssignedAckAt).toBeNull()

    const ack = await app.request('/api/profile', {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({
        motorist: stillPending.motorist,
        vehicle: stillPending.vehicle,
        insurer: stillPending.insurer,
        broker: stillPending.broker,
        policy: stillPending.policy,
        brokerAutoAssignAck: true,
      }),
    })
    expect(ack.status).toBe(200)
    const done = (await ack.json()) as typeof profile
    expect(done.motorist.brokerAutoAssignedAckAt).toBeTruthy()
    expect(getDb().motorists.find((m) => m.id === motorist.user.motoristId)?.brokerAutoAssignedAckAt).toBeTruthy()
  })
})


describe('API broker profile', () => {
  it('updates name, phone and avatar path; syncs displayName', async () => {
    const { app, getDb } = memory()
    const broker = await signup(app, 'broker', 'Salma Benali')
    const get = await app.request('/api/broker/profile', { headers: broker.headers })
    expect(get.status).toBe(200)
    const before = (await get.json()) as {
      firstName: string
      lastName: string
      phone: string
      displayName: string
    }
    expect(before.firstName).toBe('Salma')
    expect(before.lastName).toBe('Benali')

    const put = await app.request('/api/broker/profile', {
      method: 'PUT',
      headers: broker.headers,
      body: JSON.stringify({
        firstName: 'Sara',
        lastName: 'Amrani',
        phone: '+212612000111',
        avatarPhotoPath: 'brokers/avatar.jpg',
      }),
    })
    expect(put.status).toBe(200)
    const body = (await put.json()) as {
      firstName: string
      lastName: string
      phone: string
      displayName: string
      avatarPhotoPath: string | null
      user: { displayName: string }
    }
    expect(body.firstName).toBe('Sara')
    expect(body.lastName).toBe('Amrani')
    expect(body.phone).toBe('+212612000111')
    expect(body.displayName).toBe('Sara Amrani')
    expect(body.avatarPhotoPath).toBe('brokers/avatar.jpg')
    expect(body.user.displayName).toBe('Sara Amrani')

    const row = getDb().brokers.find((b) => b.id === broker.user.brokerId)
    expect(row?.phone).toBe('+212612000111')
    expect(row?.displayName).toBe('Sara Amrani')
    expect(getDb().users.find((u) => u.id === broker.user.id)?.displayName).toBe('Sara Amrani')

    const listed = await app.request('/api/brokers', { headers: broker.headers })
    expect(listed.status).toBe(200)
    const brokers = (await listed.json()) as Array<{ id: string; phone: string | null }>
    expect(brokers.find((b) => b.id === broker.user.brokerId)?.phone).toBe('+212612000111')
  })

  it('forbids motorist on broker profile routes', async () => {
    const { app } = memory()
    const motorist = await signup(app, 'motorist', 'Nadia')
    const get = await app.request('/api/broker/profile', { headers: motorist.headers })
    expect(get.status).toBe(403)
    const put = await app.request('/api/broker/profile', {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify({ firstName: 'X', lastName: 'Y' }),
    })
    expect(put.status).toBe(403)
  })
})


describe('API motorist close desk sync', () => {
  it('writes cancelled on pack stop and keeps dossier readable', async () => {
    const { app, getDb } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    await linkMotoristToBroker(app, motorist, broker.user.brokerId!, getDb)
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    pack.evidence.pv = 'required'
    const put = await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    expect(put.status).toBe(200)

    const queue = await app.request('/api/broker/queue', { headers: broker.headers })
    expect(queue.status).toBe(200)
    const items = (await queue.json()) as Array<{
      dossierId: string
      dossier: { status: string; closedReason: string | null; closedAt: string | null }
      events: Array<{ label: string; actor: string }>
    }>
    expect(items).toHaveLength(1)
    expect(items[0].dossier.closedReason).toBe('cancelled')
    expect(items[0].dossier.closedAt).toBeTruthy()
    expect(items[0].dossier.status).toBe('blocked_missing_evidence')
    expect(items[0].events.some((e) => e.label.includes('arrêté') && e.actor === 'motorist')).toBe(
      true,
    )

    const one = await app.request(`/api/broker/dossiers/${items[0].dossierId}`, {
      headers: broker.headers,
    })
    expect(one.status).toBe(200)
    const body = (await one.json()) as {
      dossier: { closedReason: string | null }
    }
    expect(body.dossier.closedReason).toBe('cancelled')
  })

  it('writes archived when archivedAt set without cancel', async () => {
    const { app, getDb } = memory()
    const broker = await signup(app, 'broker', 'Salma')
    const motorist = await signup(app, 'motorist', 'Nadia El Mansouri')
    await linkMotoristToBroker(app, motorist, broker.user.brokerId!, getDb)
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    pack.evidence.pv = 'not_needed'
    pack.evidence.constat = 'complete'
    pack.incident.archivedAt = '2026-09-24T11:00:00.000Z'
    const put = await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    expect(put.status).toBe(200)

    const queue = await app.request('/api/broker/queue', { headers: broker.headers })
    const items = (await queue.json()) as Array<{
      dossier: { closedReason: string | null; closedAt: string | null }
      events: Array<{ label: string }>
    }>
    expect(items[0].dossier.closedReason).toBe('archived')
    expect(items[0].dossier.closedAt).toBe('2026-09-24T11:00:00.000Z')
    expect(items[0].events.some((e) => e.label.includes('archivé'))).toBe(true)
  })

  it('does not create desk dossier when motorist has no broker', async () => {
    const { app, getDb } = memory()
    const motorist = await signup(app, 'motorist', 'Solo Motorist')
    const pack = bindPack(applyEvidenceRules(nadiaMissingConstatPack()), motorist.user)
    pack.evidence.pv = 'required'
    await app.request(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      headers: motorist.headers,
      body: JSON.stringify(pack),
    })
    expect(getDb().dossiers).toHaveLength(0)
  })
})
