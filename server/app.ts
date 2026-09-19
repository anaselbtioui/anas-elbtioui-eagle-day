import { randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppUserRecord, AuthUser } from '../src/domain/auth.ts'
import {
  assignMotoristBroker,
  hashPassword,
  insertUser,
  isRole,
  listBrokerClients,
  listRegisteredBrokers,
  normalizeEmail,
  provisionBroker,
  provisionMotorist,
  publicUser,
  signToken,
  userFromToken,
  verifyPassword,
} from './auth.ts'
import { applyEvidenceRules, canSubmit, dossierAfterDraft, dossierAfterSubmit, offerAssistance } from '../src/domain/rules.ts'
import {
  nadiaMissingConstatPack,
  nadiaProfile,
  saraInjuryPack,
  saraMotorist,
} from '../src/domain/fixtures.ts'
import type { AssistanceOnContract, Declaration, EvidencePack, Profile } from '../src/domain/types.ts'
import type { DocumentRequestPiece, MessageIntent } from '../src/domain/desk.ts'
import {
  applyApproveDraft,
  applyCreateDraft,
  applyHandoff,
  applyRequest,
  applySetDraftBody,
  applySetHumanApproved,
  applySetOwner,
  applyToggleTask,
  applyPieces,
  assembleBundle,
  ensureDesk,
  fileFromDb,
  filesForMotorist,
  listDeskBundles,
  listDeskBundlesForBroker,
  brokerOwnsBundle,
  mergePack,
  newEmptyPack,
  packFromDb,
  packsForMotorist,
  persistDeskBundle,
  profileFromDb,
  mergeNadiaDemo,
  mergeSaraDemo,
  writePackAndSync,
  type CreatePackInput,
  type EvidencePieces,
  type PackPatch,
  type IncidentFile,
} from './core.ts'
import { emptyDb, loadDb, saveDb, upsert, type Db } from './store.ts'
import { mergeImport, type FieldResolution, type ImportOutcome, type ImportSource } from '../src/domain/browser-import.ts'
import {
  closeBrowser,
  createSession,
  getSession,
  publicSession,
  pushStep,
  resolveImportMode,
  runImportGraph,
  signalResume,
  notify,
} from './import-agent/index.ts'

export type SessionSnapshot = {
  profile: Profile
  packs: EvidencePack[]
  files: IncidentFile[]
}

type AppEnv = { Variables: { auth: AuthUser | null } }
type Ctx = Context<AppEnv>

function needAuth(c: Ctx) {
  if (!c.get('auth')) return c.json({ error: 'unauthorized' }, 401)
  return null
}

function needMotorist(c: Ctx) {
  const denied = needAuth(c)
  if (denied) return denied
  const auth = c.get('auth')
  if (!auth || auth.role !== 'motorist' || !auth.motoristId) {
    return c.json({ error: 'forbidden' }, 403)
  }
  return null
}

function needBroker(c: Ctx) {
  const denied = needAuth(c)
  if (denied) return denied
  const auth = c.get('auth')
  if (!auth || auth.role !== 'broker') return c.json({ error: 'forbidden' }, 403)
  return null
}

function canSeePack(auth: AuthUser, pack: EvidencePack, db: Db): boolean {
  if (auth.role === 'broker') {
    if (!auth.brokerId) return false
    const profile = profileFromDb(db, pack.incident.motoristId)
    return profile?.policy.brokerId === auth.brokerId
  }
  return pack.incident.motoristId === auth.motoristId
}

function needBrokerId(c: Ctx) {
  const denied = needBroker(c)
  if (denied) return denied
  if (!c.get('auth')?.brokerId) return c.json({ error: 'broker_required' }, 403)
  return null
}

async function readJson<T>(c: { req: { json: () => Promise<unknown> } }, fallback: T): Promise<T> {
  try {
    return (await c.req.json()) as T
  } catch {
    return fallback
  }
}

function writeDossier(
  db: Db,
  pack: EvidencePack,
  declaration: Declaration,
  dossier: Db['dossiers'][number],
): Db {
  return ensureDesk(
    {
      ...db,
      declarations: upsert(db.declarations, declaration),
      dossiers: upsert(db.dossiers, dossier),
    },
    dossier,
    pack,
  )
}

export function createApp(load: () => Promise<Db> = loadDb, persist: (db: Db) => Promise<void> = saveDb) {
  const app = new Hono<AppEnv>()
  app.use(
    '/*',
    cors({
      origin: (origin) => {
        if (!origin) return '*'
        if (
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          origin.endsWith('.vercel.app') ||
          origin.includes('anas-elbtioui-eagle')
        ) {
          return origin
        }
        return origin
      },
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  app.use('*', async (c, next) => {
    c.set('auth', null)
    const header = c.req.header('Authorization') ?? ''
    const raw = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (raw) {
      const db = await load()
      c.set('auth', await userFromToken(db, raw))
    }
    await next()
  })

  app.get('/health', (c) =>
    c.json({
      ok: true,
      service: 'labas-api',
      store: process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'json',
    }),
  )

  app.post('/api/auth/signup', async (c) => {
    const body = await readJson<{
      role?: string
      email?: string
      password?: string
      displayName?: string
    }>(c, {})
    if (!isRole(body.role)) return c.json({ error: 'role_required' }, 400)
    const email = normalizeEmail(body.email ?? '')
    const password = body.password ?? ''
    const displayName = (body.displayName ?? '').trim()
    if (!email.includes('@')) return c.json({ error: 'invalid_email' }, 400)
    if (password.length < 8) return c.json({ error: 'weak_password' }, 400)
    if (!displayName) return c.json({ error: 'name_required' }, 400)
    const db = await load()
    if (db.users.some((u) => u.email === email)) return c.json({ error: 'email_taken' }, 409)
    let next = db
    let motoristId: string | null = null
    let brokerId: string | null = null
    let vehicleId: string | null = null
    let insurerId: string | null = null
    let policyId: string | null = null
    if (body.role === 'motorist') {
      const provisioned = provisionMotorist(next, displayName)
      next = provisioned.db
      motoristId = provisioned.motoristId
      vehicleId = provisioned.vehicleId
      insurerId = provisioned.insurerId
      policyId = provisioned.policyId
      brokerId = null
    } else {
      const provisioned = provisionBroker(next, displayName)
      next = provisioned.db
      brokerId = provisioned.brokerId
    }
    const row: AppUserRecord = {
      id: randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      role: body.role,
      displayName,
      onboarded: body.role === 'broker',
      motoristId,
      brokerId,
      vehicleId,
      insurerId,
      policyId,
    }
    next = insertUser(next, row)
    await persist(next)
    const user = publicUser(row)
    return c.json({ token: await signToken(user), user }, 201)
  })

  app.post('/api/auth/signin', async (c) => {
    const body = await readJson<{ email?: string; password?: string }>(c, {})
    const email = normalizeEmail(body.email ?? '')
    const db = await load()
    const row = db.users.find((u) => u.email === email)
    if (!row || !(await verifyPassword(body.password ?? '', row.passwordHash))) {
      return c.json({ error: 'invalid_credentials' }, 401)
    }
    const user = publicUser(row)
    return c.json({ token: await signToken(user), user })
  })

  app.get('/api/auth/me', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    return c.json(c.get('auth'))
  })

  /** Prolong session while access JWT still valid. */
  app.post('/api/auth/refresh', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const user = c.get('auth')!
    return c.json({ token: await signToken(user), user })
  })

  app.get('/api/contacts', async (c) => {
    const db = await load()
    const flag = (c.req.query('assistanceOnContract') ?? 'unknown') as AssistanceOnContract
    const list = db.contacts.filter((contact) => contact.role !== 'assistance' || offerAssistance(flag))
    return c.json(list)
  })

  app.get('/api/profile', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    const profile = profileFromDb(db, auth.motoristId!)
    if (!profile) return c.json({ error: 'no_profile' }, 404)
    return c.json(profile)
  })

  app.put('/api/profile', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const body = await c.req.json<Profile>()
    if (body.motorist.id !== auth.motoristId) return c.json({ error: 'forbidden' }, 403)

    const chosenBrokerId = body.policy.brokerId?.trim() || body.broker.id?.trim() || ''
    if (!chosenBrokerId) return c.json({ error: 'broker_required' }, 400)

    const db = await load()
    const registered = listRegisteredBrokers(db)
    const match = registered.find((b) => b.id === chosenBrokerId)
    if (!match) return c.json({ error: 'broker_not_found' }, 400)

    const broker = db.brokers.find((b) => b.id === chosenBrokerId)!
    const policy = {
      ...body.policy,
      id: auth.policyId ?? body.policy.id,
      brokerId: chosenBrokerId,
    }
    let next: Db = {
      ...db,
      motorists: upsert(db.motorists, body.motorist),
      vehicles: upsert(db.vehicles, body.vehicle),
      insurers: upsert(db.insurers, body.insurer),
      policies: upsert(db.policies, policy),
    }
    next = assignMotoristBroker(next, auth.id, policy.id, chosenBrokerId)
    await persist(next)

    const saved: Profile = {
      ...body,
      broker: { id: broker.id, displayName: broker.displayName },
      policy,
    }
    return c.json(saved)
  })

  /** Registered brokers for motorist picker (auth required). */
  app.get('/api/brokers', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const db = await load()
    return c.json(listRegisteredBrokers(db))
  })

  app.post('/api/profile/demo', async (c) => {
    const db = await load()
    const next = mergeNadiaDemo(db)
    await persist(next)
    return c.json(nadiaProfile)
  })

  app.get('/api/session', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    const motoristId = auth.motoristId!
    const profile = profileFromDb(db, motoristId)
    if (!profile) return c.json({ error: 'no_profile' }, 404)
    const snapshot: SessionSnapshot = {
      profile,
      packs: packsForMotorist(db, motoristId),
      files: filesForMotorist(db, motoristId),
    }
    return c.json(snapshot)
  })

  app.get('/api/packs', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const db = await load()
    return c.json(packsForMotorist(db, c.get('auth')!.motoristId!))
  })

  app.get('/api/packs/:incidentId', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const db = await load()
    const pack = packFromDb(db, c.req.param('incidentId'))
    if (!pack) return c.json({ error: 'not_found' }, 404)
    if (!canSeePack(c.get('auth')!, pack, db)) return c.json({ error: 'forbidden' }, 403)
    return c.json(pack)
  })

  app.put('/api/packs/:incidentId', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const body = await c.req.json<EvidencePack>()
    if (body.incident.id !== incidentId) {
      return c.json({ error: 'id_mismatch' }, 400)
    }
    if (body.incident.motoristId !== c.get('auth')!.motoristId) {
      return c.json({ error: 'forbidden' }, 403)
    }
    const db = await load()
    const next = writePackAndSync(db, body)
    await persist(next)
    return c.json(packFromDb(next, incidentId))
  })

  app.patch('/api/packs/:incidentId', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const db = await load()
    const existing = packFromDb(db, incidentId)
    if (!existing) return c.json({ error: 'not_found' }, 404)
    if (!canSeePack(c.get('auth')!, existing, db)) return c.json({ error: 'forbidden' }, 403)
    const patch = await c.req.json<PackPatch>()
    const next = writePackAndSync(db, mergePack(existing, patch))
    await persist(next)
    return c.json(packFromDb(next, incidentId))
  })

  app.post('/api/packs/:incidentId/pieces', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const db = await load()
    const existing = packFromDb(db, incidentId)
    if (!existing) return c.json({ error: 'not_found' }, 404)
    if (!canSeePack(c.get('auth')!, existing, db)) return c.json({ error: 'forbidden' }, 403)
    const pieces = await c.req.json<EvidencePieces>()
    const next = writePackAndSync(db, applyPieces(existing, pieces))
    await persist(next)
    const file = fileFromDb(next, incidentId)
    return c.json(file)
  })

  app.post('/api/packs', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    const body = await readJson<CreatePackInput>(c, {})
    const pack = newEmptyPack(db, {
      ...body,
      motoristId: auth.motoristId!,
      policyId: auth.policyId ?? body.policyId,
    })
    if ('error' in pack) return c.json({ error: pack.error }, 404)
    const next = writePackAndSync(db, pack)
    await persist(next)
    return c.json(pack, 201)
  })

  app.get('/api/files/:incidentId', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const db = await load()
    const file = fileFromDb(db, c.req.param('incidentId'))
    if (!file) return c.json({ error: 'not_found' }, 404)
    if (!canSeePack(c.get('auth')!, file.pack, db)) return c.json({ error: 'forbidden' }, 403)
    return c.json(file)
  })

  app.get('/api/declarations', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    const incidentId = c.req.query('incidentId')
    const list = incidentId
      ? db.declarations.filter((d) => d.incidentId === incidentId)
      : db.declarations
    if (auth.role === 'broker') return c.json(list)
    const mine = new Set(packsForMotorist(db, auth.motoristId!).map((p) => p.incident.id))
    return c.json(list.filter((d) => mine.has(d.incidentId)))
  })

  app.put('/api/declarations/:incidentId', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const body = await c.req.json<Partial<Declaration>>()
    const db = await load()
    const pack = packFromDb(db, incidentId)
    if (!pack) return c.json({ error: 'pack_not_found' }, 404)
    if (!canSeePack(c.get('auth')!, pack, db)) return c.json({ error: 'forbidden' }, 403)
    const existing = db.declarations.find((d) => d.incidentId === incidentId)
    if (existing?.submittedAt) return c.json({ error: 'already_submitted' }, 409)
    const declaration: Declaration = {
      id: existing?.id ?? randomUUID(),
      incidentId,
      narrative: body.narrative ?? existing?.narrative ?? '',
      documentRefs: body.documentRefs ?? existing?.documentRefs ?? [],
      channel: body.channel ?? existing?.channel ?? 'broker',
      submittedAt: null,
    }
    const policy = db.policies.find((p) => p.id === pack.incident.policyId)
    const draft = dossierAfterDraft(declaration.id, pack, policy?.number ?? null)
    const dossier = {
      id: db.dossiers.find((d) => d.declarationId === declaration.id)?.id ?? randomUUID(),
      ...draft,
    }
    const next = writeDossier(db, pack, declaration, dossier)
    await persist(next)
    return c.json({ declaration, dossier })
  })

  app.post('/api/declarations/:incidentId/submit', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const db = await load()
    const pack = packFromDb(db, incidentId)
    if (!pack) return c.json({ error: 'pack_not_found' }, 404)
    if (!canSeePack(c.get('auth')!, pack, db)) return c.json({ error: 'forbidden' }, 403)
    let declaration = db.declarations.find((d) => d.incidentId === incidentId)
    if (!declaration) {
      declaration = {
        id: randomUUID(),
        incidentId,
        narrative: '',
        documentRefs: [],
        channel: 'broker',
        submittedAt: null,
      }
    }
    if (declaration.submittedAt) return c.json({ error: 'already_submitted' }, 409)
    if (!canSubmit(pack.evidence)) {
      const policy = db.policies.find((p) => p.id === pack.incident.policyId)
      const draft = dossierAfterDraft(declaration.id, pack, policy?.number ?? null)
      const dossier = {
        id: db.dossiers.find((d) => d.declarationId === declaration.id)?.id ?? randomUUID(),
        ...draft,
      }
      const next = writeDossier(db, pack, declaration, dossier)
      await persist(next)
      return c.json({ error: 'blocked_missing_evidence', declaration, dossier }, 409)
    }
    const submitted: Declaration = {
      ...declaration,
      submittedAt: new Date().toISOString(),
    }
    const policy = db.policies.find((p) => p.id === pack.incident.policyId)
    const after = dossierAfterSubmit(submitted, pack, policy?.number ?? null)
    const dossier = {
      id: db.dossiers.find((d) => d.declarationId === submitted.id)?.id ?? randomUUID(),
      ...after,
    }
    const next = writeDossier(db, pack, submitted, dossier)
    await persist(next)
    return c.json({ declaration: submitted, dossier })
  })

  app.get('/api/dossiers', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    const incidentId = c.req.query('incidentId')
    if (!incidentId) {
      if (auth.role !== 'broker') return c.json({ error: 'forbidden' }, 403)
      return c.json(db.dossiers)
    }
    const file = fileFromDb(db, incidentId)
    if (!file?.dossier) return c.json({ error: 'not_found' }, 404)
    if (!canSeePack(auth, file.pack, db)) return c.json({ error: 'forbidden' }, 403)
    return c.json(file.dossier)
  })

  app.get('/api/dossiers/:declarationId', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    const db = await load()
    const dossier = db.dossiers.find((d) => d.declarationId === c.req.param('declarationId'))
    if (!dossier) return c.json({ error: 'not_found' }, 404)
    const declaration = db.declarations.find((d) => d.id === dossier.declarationId)
    const pack = declaration ? packFromDb(db, declaration.incidentId) : null
    if (!pack || !canSeePack(c.get('auth')!, pack, db)) return c.json({ error: 'forbidden' }, 403)
    return c.json(dossier)
  })

  app.use('/api/broker/*', async (c, next) => {
    const denied = needBroker(c)
    if (denied) return denied
    await next()
  })

  app.get('/api/broker/queue', async (c) => {
    const denied = needBrokerId(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    return c.json(listDeskBundlesForBroker(db, auth.brokerId!))
  })

  app.get('/api/broker/clients', async (c) => {
    const denied = needBrokerId(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    return c.json(listBrokerClients(db, auth.brokerId!))
  })

  app.get('/api/broker/dossiers/:dossierId', async (c) => {
    const denied = needBrokerId(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const db = await load()
    const bundle = assembleBundle(db, c.req.param('dossierId'))
    if (!bundle) return c.json({ error: 'not_found' }, 404)
    if (!brokerOwnsBundle(bundle, auth.brokerId!)) return c.json({ error: 'forbidden' }, 403)
    return c.json(bundle)
  })

  app.post('/api/broker/dossiers/:dossierId/requests', async (c) => {
    const denied = needBrokerId(c)
    if (denied) return denied
    const body = await c.req.json<{ piece?: DocumentRequestPiece; note?: string }>()
    if (!body.piece) return c.json({ error: 'piece_required' }, 400)
    const auth = c.get('auth')!
    const db = await load()
    const existing = assembleBundle(db, c.req.param('dossierId'))
    if (!existing) return c.json({ error: 'not_found' }, 404)
    if (!brokerOwnsBundle(existing, auth.brokerId!)) return c.json({ error: 'forbidden' }, 403)
    const result = applyRequest(db, c.req.param('dossierId'), body.piece, body.note ?? '')
    if ('error' in result) return c.json({ error: result.error }, 404)
    await persist(result.db)
    return c.json(result.bundle, 201)
  })

  app.post('/api/broker/dossiers/:dossierId/drafts', async (c) => {
    const body = await readJson<{ intent?: MessageIntent; pieceLabel?: string }>(c, {})
    if (!body.intent) return c.json({ error: 'intent_required' }, 400)
    const db = await load()
    const result = applyCreateDraft(db, c.req.param('dossierId'), body.intent, body.pieceLabel)
    if ('error' in result) return c.json({ error: result.error }, 404)
    await persist(result.db)
    return c.json(result.bundle, 201)
  })

  app.patch('/api/broker/dossiers/:dossierId/drafts/:draftId', async (c) => {
    const body = await c.req.json<{ humanApproved?: boolean; body?: string }>()
    const hasApproved = typeof body.humanApproved === 'boolean'
    const hasBody = typeof body.body === 'string'
    if (!hasApproved && !hasBody) {
      return c.json({ error: 'body_or_humanApproved_required' }, 400)
    }
    let db = await load()
    const dossierId = c.req.param('dossierId')
    const draftId = c.req.param('draftId')
    if (hasBody) {
      const result = applySetDraftBody(db, dossierId, draftId, body.body!)
      if ('error' in result) return c.json({ error: result.error }, 404)
      db = result.db
    }
    if (hasApproved) {
      const result = applySetHumanApproved(db, dossierId, draftId, body.humanApproved!)
      if ('error' in result) return c.json({ error: result.error }, 404)
      db = result.db
      await persist(db)
      return c.json(result.bundle)
    }
    const bundle = assembleBundle(db, dossierId)
    if (!bundle) return c.json({ error: 'not_found' }, 404)
    await persist(db)
    return c.json(bundle)
  })

  app.post('/api/broker/dossiers/:dossierId/owner', async (c) => {
    const body = await c.req.json<{ owner?: string }>()
    if (typeof body.owner !== 'string') return c.json({ error: 'owner_required' }, 400)
    const db = await load()
    const result = applySetOwner(db, c.req.param('dossierId'), body.owner)
    if ('error' in result) return c.json({ error: result.error }, 404)
    await persist(result.db)
    return c.json(result.bundle)
  })

  app.post('/api/broker/dossiers/:dossierId/drafts/:draftId/approve', async (c) => {
    const db = await load()
    const result = applyApproveDraft(db, c.req.param('dossierId'), c.req.param('draftId'))
    if ('error' in result) {
      const status = result.error === 'not_found' ? 404 : 409
      return c.json({ error: result.error }, status)
    }
    await persist(result.db)
    return c.json(result.bundle)
  })

  app.post('/api/broker/dossiers/:dossierId/tasks/:taskId/toggle', async (c) => {
    const db = await load()
    const result = applyToggleTask(db, c.req.param('dossierId'), c.req.param('taskId'))
    if ('error' in result) return c.json({ error: result.error }, 404)
    await persist(result.db)
    return c.json(result.bundle)
  })

  app.post('/api/broker/dossiers/:dossierId/handoff', async (c) => {
    const db = await load()
    const result = applyHandoff(db, c.req.param('dossierId'))
    if ('error' in result) {
      const status = result.error === 'not_found' ? 404 : 409
      return c.json({ error: result.error }, status)
    }
    await persist(result.db)
    return c.json(result.bundle)
  })

  app.get('/api/broker/import/mode', (c) => {
    return c.json({ mode: resolveImportMode() })
  })

  app.post('/api/broker/import/sessions', async (c) => {
    const body = await c.req.json<{
      source?: ImportSource
      consent?: boolean
      fixtureOutcome?: ImportOutcome
    }>()
    if (body.consent !== true) return c.json({ error: 'consent_required' }, 400)
    if (body.source !== 'TRT' && body.source !== 'OuiAssur') {
      return c.json({ error: 'source_required' }, 400)
    }
    const mode = resolveImportMode()
    const fixtureOutcome: ImportOutcome =
      body.fixtureOutcome === 'duplicate' ||
      body.fixtureOutcome === 'conflict' ||
      body.fixtureOutcome === 'interrupted' ||
      body.fixtureOutcome === 'new'
        ? body.fixtureOutcome
        : 'new'
    const auth = c.get('auth')!
    const owner = auth.displayName || 'Courtier'
    const session = createSession({
      source: body.source,
      mode,
      fixtureOutcome: mode === 'fixture' ? fixtureOutcome : 'new',
      owner,
    })
    const db = await load()
    const bundles = listDeskBundles(db)
    void runImportGraph({ session, bundles }).catch((err) => {
      pushStep(session, 'error', err instanceof Error ? err.message : 'graph_failed')
      session.status = 'interrupted'
      notify(session)
    })
    return c.json({ sessionId: session.id, mode }, 201)
  })

  app.get('/api/broker/import/sessions/:id', (c) => {
    const session = getSession(c.req.param('id'))
    if (!session) return c.json({ error: 'not_found' }, 404)
    return c.json(publicSession(session))
  })

  app.get('/api/broker/import/sessions/:id/events', async (c) => {
    const session = getSession(c.req.param('id'))
    if (!session) return c.json({ error: 'not_found' }, 404)
    const encoder = new TextEncoder()
    let closed = false
    const stream = new ReadableStream({
      start(controller) {
        const send = () => {
          if (closed) return
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(publicSession(session))}\n\n`),
          )
          if (
            session.status === 'await_confirm' ||
            session.status === 'merged' ||
            session.status === 'interrupted' ||
            session.status === 'cancelled'
          ) {
            closed = true
            session.listeners.delete(send)
            controller.close()
          }
        }
        session.listeners.add(send)
        send()
        c.req.raw.signal.addEventListener('abort', () => {
          closed = true
          session.listeners.delete(send)
          try {
            controller.close()
          } catch {
            /* ignore */
          }
        })
      },
      cancel() {
        closed = true
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  })

  app.post('/api/broker/import/sessions/:id/resume', async (c) => {
    const session = getSession(c.req.param('id'))
    if (!session) return c.json({ error: 'not_found' }, 404)
    const body = await c.req.json<{ action?: 'continue' | 'cancel' }>()
    if (body.action !== 'continue' && body.action !== 'cancel') {
      return c.json({ error: 'action_required' }, 400)
    }
    if (session.status !== 'human_gate') {
      return c.json({ error: 'not_waiting' }, 409)
    }
    const ok = signalResume(session, body.action)
    if (!ok) return c.json({ error: 'no_waiter' }, 409)
    if (body.action === 'cancel') {
      pushStep(session, 'warn', 'Annulation demandée')
    }
    return c.json(publicSession(session))
  })

  app.post('/api/broker/import/sessions/:id/confirm', async (c) => {
    const session = getSession(c.req.param('id'))
    if (!session) return c.json({ error: 'not_found' }, 404)
    if (session.status !== 'await_confirm' || !session.classification || !session.extracted) {
      return c.json({ error: 'not_ready' }, 409)
    }
    const body = await readJson<{ resolutions?: FieldResolution[] }>(c, {})
    const auth = c.get('auth')!
    const db = await load()
    const bundles = listDeskBundles(db)
    const result = mergeImport({
      classification: session.classification,
      extracted: session.extracted,
      source: session.source,
      owner: session.owner,
      bundles,
      resolutions: body.resolutions ?? [],
    })
    if (!result.ok) return c.json({ error: result.reason }, 409)

    let bundle = result.bundle
    if (auth.brokerId) {
      const brokerRow =
        db.brokers.find((b) => b.id === auth.brokerId) ??
        ({ id: auth.brokerId, displayName: auth.displayName } as const)
      bundle = {
        ...bundle,
        profile: {
          ...bundle.profile,
          broker: brokerRow,
          policy: { ...bundle.profile.policy, brokerId: auth.brokerId },
        },
        provenance: { ...bundle.provenance, owner: auth.displayName },
      }
    }

    const nextDb = persistDeskBundle(db, bundle)
    await persist(nextDb)
    session.status = 'merged'
    session.mergedDossierId = bundle.dossierId
    pushStep(session, 'ok', `Fusion locale · ${bundle.dossierId}`)
    notify(session)
    return c.json({ bundle, created: result.created })
  })

  app.post('/api/broker/import/sessions/:id/cancel', async (c) => {
    const session = getSession(c.req.param('id'))
    if (!session) return c.json({ error: 'not_found' }, 404)
    if (session.status === 'human_gate') {
      signalResume(session, 'cancel')
    }
    session.status = 'cancelled'
    pushStep(session, 'warn', 'Session annulée')
    await closeBrowser(session.browser)
    session.browser = null
    notify(session)
    return c.json(publicSession(session))
  })

  app.post('/api/demo/nadia', async (c) => {
    const db = await load()
    const next = mergeNadiaDemo(db)
    await persist(next)
    return c.json({ profile: nadiaProfile, pack: nadiaMissingConstatPack() })
  })

  app.post('/api/demo/sara', async (c) => {
    const db = await load()
    const next = mergeSaraDemo(db)
    await persist(next)
    return c.json({ motorist: saraMotorist, pack: applyEvidenceRules(saraInjuryPack()) })
  })

  app.post('/api/reset', async (c) => {
    if (process.env.ALLOW_RESET !== '1' && process.env.NODE_ENV === 'production') {
      return c.json({ error: 'reset_disabled' }, 403)
    }
    const db = emptyDb()
    await persist(db)
    return c.json({ ok: true })
  })

  return app
}

