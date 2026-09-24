import { randomUUID } from 'node:crypto'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import type { AppUserRecord, AuthUser } from '@labas/domain/auth.ts'
import {
  assignMotoristBroker,
  hashPassword,
  insertUser,
  isRole,
  listBrokerClients,
  listRegisteredBrokers,
  markOnboarded,
  normalizeEmail,
  provisionBroker,
  provisionMotorist,
  publicUser,
  signToken,
  userFromToken,
  verifyPassword,
} from './auth.ts'
import { applyEvidenceRules, canSubmit, dossierAfterDraft, dossierAfterSubmit, offerAssistance } from '@labas/domain/rules.ts'
import {
  nadiaMissingConstatPack,
  nadiaProfile,
  saraInjuryPack,
  saraMotorist,
} from '@labas/domain/fixtures.ts'
import type { AssistanceOnContract, Declaration, EvidencePack, Profile } from '@labas/domain/types.ts'
import type { DocumentRequestPiece, MessageIntent } from '@labas/domain/desk.ts'
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
  preservePhotoStorage,
  type CreatePackInput,
  type EvidencePieces,
  type PackPatch,
  type IncidentFile,
} from './core.ts'
import {
  evidenceObjectPath,
  parseDataUrl,
  signedEvidenceUrl,
  storageConfigured,
  uploadEvidenceObject,
  walletDocObjectPath,
} from './storage.ts'
import { emptyDb, loadDb, saveDb, upsert, type Db } from './store.ts'
import { exclusiveDbWrite } from './write-lock.ts'
import {
  fetchProfileById,
  supabaseConfigured,
  upsertAppUserUnlocked,
  upsertProfileEntitiesUnlocked,
} from './supabase-store.ts'
import { mergeImport, type FieldResolution, type ImportOutcome, type ImportSource } from '@labas/domain/browser-import.ts'
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

/** Postgres returns `+00:00`, JS emits `Z` — compare the instant, not the string. */
function sameInstant(a: string, b: string): boolean {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a === b
  return ta === tb
}

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

export function createApp(
  loadFn: () => Promise<Db> = loadDb,
  persistFn: (db: Db) => Promise<void> = saveDb,
  /** Full replace (wipe+write). Supabase must pass replaceDb; default = persistFn for JSON/memory. */
  replaceFn: (db: Db) => Promise<void> = persistFn,
) {
  const load = loadFn
  /** Serialize load→mutate→persist within one process. */
  async function write(mutator: (db: Db) => Db | Promise<Db>): Promise<Db> {
    return exclusiveDbWrite(loadFn, persistFn, mutator)
  }
  /** Profile writes: targeted upsert on Supabase (motorist tables only). */
  async function writeProfile(
    motoristId: string,
    mutator: (db: Db) => Db | Promise<Db>,
  ): Promise<Db> {
    if (!supabaseConfigured()) return write(mutator)
    return exclusiveDbWrite(
      loadFn,
      async (db) => {
        const profile = profileFromDb(db, motoristId)
        if (profile) await upsertProfileEntitiesUnlocked(profile)
        const user = db.users.find((u) => u.motoristId === motoristId)
        if (user) await upsertAppUserUnlocked(user)
      },
      mutator,
    )
  }
  const persist = persistFn
  const replace = replaceFn
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
      // JWT claims only — do not reload full store on every request.
      c.set('auth', await userFromToken(null, raw))
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
    let created: AppUserRecord | null = null
    let taken = false
    await write(async (db) => {
      if (db.users.some((u) => u.email === email)) {
        taken = true
        return db
      }
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
        role: body.role!,
        displayName,
        onboarded: body.role === 'broker',
        motoristId,
        brokerId,
        vehicleId,
        insurerId,
        policyId,
      }
      created = row
      return insertUser(next, row)
    })
    if (taken) return c.json({ error: 'email_taken' }, 409)
    if (!created) return c.json({ error: 'signup_failed' }, 500)
    const user = publicUser(created)
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
    if (supabaseConfigured()) {
      try {
        const profile = await fetchProfileById(auth.motoristId!)
        if (!profile) return c.json({ error: 'no_profile' }, 404)
        return c.json(profile)
      } catch {
        /* fall through to full load */
      }
    }
    const db = await load()
    const profile = profileFromDb(db, auth.motoristId!)
    if (!profile) return c.json({ error: 'no_profile' }, 404)
    return c.json(profile)
  })

  async function saveMotoristProfile(c: Ctx) {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const body = await c.req.json<Profile>()
    if (body.motorist.id !== auth.motoristId) return c.json({ error: 'forbidden' }, 403)

    const chosenBrokerId =
      body.policy.brokerId?.trim() || body.broker.id?.trim() || ''
    let saved: Profile | null = null
    let err: 'broker_not_found' | 'conflict' | null = null
    const now = new Date().toISOString()

    await writeProfile(auth.motoristId!, (db) => {
      const existing = db.motorists.find((m) => m.id === auth.motoristId)
      // Optimistic concurrency: client must send the stamp it last read.
      if (
        body.motorist.updatedAt &&
        existing?.updatedAt &&
        !sameInstant(body.motorist.updatedAt, existing.updatedAt)
      ) {
        err = 'conflict'
        return db
      }

      const motorist = {
        ...body.motorist,
        firstName: body.motorist.firstName ?? null,
        lastName: body.motorist.lastName ?? null,
        assistanceNumber: body.motorist.assistanceNumber ?? null,
        brokerPhone: body.motorist.brokerPhone ?? null,
        onboardingStep: body.motorist.onboardingStep ?? 0,
        updatedAt: now,
      }

      const registered = listRegisteredBrokers(db)
      const chosen =
        chosenBrokerId ||
        (registered.length === 1 ? registered[0]!.id : '')

      // Draft OK without courtier — required only when finishing onboarding (client).
      if (!chosen) {
        const policy = {
          ...body.policy,
          id: auth.policyId ?? body.policy.id,
          brokerId: null,
        }
        const next: Db = {
          ...db,
          motorists: upsert(db.motorists, motorist),
          vehicles: upsert(db.vehicles, body.vehicle),
          insurers: upsert(db.insurers, {
            ...body.insurer,
            displayName:
              body.insurer.displayName.trim() === 'Assureur'
                ? ''
                : body.insurer.displayName.trim(),
          }),
          policies: upsert(db.policies, policy),
        }
        saved = {
          ...body,
          motorist,
          insurer: {
            ...body.insurer,
            displayName:
              body.insurer.displayName.trim() === 'Assureur'
                ? ''
                : body.insurer.displayName.trim(),
          },
          broker: { id: '', displayName: body.broker.displayName || '' },
          policy,
        }
        return next
      }

      const match = registered.find((b) => b.id === chosen)
      if (!match) {
        err = 'broker_not_found'
        return db
      }
      const broker = db.brokers.find((b) => b.id === chosen)!
      const policy = {
        ...body.policy,
        id: auth.policyId ?? body.policy.id,
        brokerId: chosen,
      }
      let next: Db = {
        ...db,
        motorists: upsert(db.motorists, motorist),
        vehicles: upsert(db.vehicles, body.vehicle),
        insurers: upsert(db.insurers, {
          ...body.insurer,
          displayName:
            body.insurer.displayName.trim() === 'Assureur'
              ? ''
              : body.insurer.displayName.trim(),
        }),
        policies: upsert(db.policies, policy),
      }
      next = assignMotoristBroker(next, auth.id, policy.id, chosen)
      saved = {
        ...body,
        motorist,
        insurer: {
          ...body.insurer,
          displayName:
            body.insurer.displayName.trim() === 'Assureur'
              ? ''
              : body.insurer.displayName.trim(),
        },
        broker: { id: broker.id, displayName: broker.displayName },
        policy,
      }
      return next
    })
    if (err === 'conflict') return c.json({ error: 'conflict' }, 409)
    if (err) return c.json({ error: err }, 400)
    return c.json(saved)
  }

  app.put('/api/profile', (c) => saveMotoristProfile(c))
  app.patch('/api/profile', (c) => saveMotoristProfile(c))

  app.post('/api/profile/complete', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    let user = auth
    await write((db) => {
      const next = markOnboarded(db, auth.id)
      const row = next.users.find((u) => u.id === auth.id)
      if (row) user = publicUser(row)
      return next
    })
    return c.json({ token: await signToken(user), user })
  })

  /** Upload a wallet document photo (permis / carte grise / attestation). */
  app.post('/api/profile/docs', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    if (!storageConfigured()) return c.json({ error: 'storage_unconfigured' }, 503)
    const auth = c.get('auth')!
    const body = await readJson<{
      kind?: 'license' | 'carteGrise' | 'attestation'
      dataUrl?: string
    }>(c, {})
    if (!body.kind || !body.dataUrl) return c.json({ error: 'kind_and_data_required' }, 400)
    let parsed
    try {
      parsed = parseDataUrl(body.dataUrl)
    } catch {
      return c.json({ error: 'invalid_data_url' }, 400)
    }
    const path = walletDocObjectPath(auth.motoristId!, body.kind, parsed.ext)
    await uploadEvidenceObject(path, parsed.bytes, parsed.mime)

    const pathKey =
      body.kind === 'license'
        ? 'licensePhotoPath'
        : body.kind === 'carteGrise'
          ? 'carteGrisePhotoPath'
          : 'attestationPhotoPath'

    await write((db) => {
      const motorist = db.motorists.find((m) => m.id === auth.motoristId)
      if (!motorist) return db
      return {
        ...db,
        motorists: upsert(db.motorists, { ...motorist, [pathKey]: path }),
      }
    })
    return c.json({ kind: body.kind, path }, 201)
  })

  app.get('/api/profile/docs/:kind/url', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    if (!storageConfigured()) return c.json({ error: 'storage_unconfigured' }, 503)
    const kind = c.req.param('kind')
    if (kind !== 'license' && kind !== 'carteGrise' && kind !== 'attestation') {
      return c.json({ error: 'invalid_kind' }, 400)
    }
    const auth = c.get('auth')!
    const db = await load()
    const motorist = db.motorists.find((m) => m.id === auth.motoristId)
    if (!motorist) return c.json({ error: 'no_profile' }, 404)
    const path =
      kind === 'license'
        ? motorist.licensePhotoPath
        : kind === 'carteGrise'
          ? motorist.carteGrisePhotoPath
          : motorist.attestationPhotoPath
    if (!path) return c.json({ error: 'not_found' }, 404)
    const url = await signedEvidenceUrl(path)
    return c.json({ url, path })
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
    const next = await write((db) => {
      const existing = packFromDb(db, incidentId)
      return writePackAndSync(db, preservePhotoStorage(existing, body))
    })
    return c.json(packFromDb(next, incidentId))
  })

  app.post('/api/packs/:incidentId/photos', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    if (!storageConfigured()) return c.json({ error: 'storage_unconfigured' }, 503)
    const incidentId = c.req.param('incidentId')
    const body = await c.req.json<{
      slot: string
      zoneId?: string | null
      label?: string
      dataUrl: string
      photoId?: string
      capturedAt?: string | null
    }>()
    if (!body?.dataUrl || !body?.slot) {
      return c.json({ error: 'slot_and_dataUrl_required' }, 400)
    }
    let parsed
    try {
      parsed = parseDataUrl(body.dataUrl)
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'invalid_data_url' }, 400)
    }
    const photoId = body.photoId?.trim() || `${incidentId}:${body.slot}`
    const path = evidenceObjectPath(incidentId, photoId, body.slot, parsed.ext)
    try {
      await uploadEvidenceObject(path, parsed.bytes, parsed.mime)
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'storage_upload' }, 502)
    }
    const photo = {
      photoId,
      slot: body.slot as EvidencePack['evidence']['photos'][number]['slot'],
      zoneId: body.zoneId ?? null,
      label: body.label ?? body.slot,
      capturedAt: body.capturedAt ?? new Date().toISOString(),
      storagePath: path,
    }
    let err: { error: string; status: 404 | 403 } | null = null
    const next = await write((db) => {
      const existing = packFromDb(db, incidentId)
      if (!existing) {
        err = { error: 'not_found', status: 404 }
        return db
      }
      if (!canSeePack(c.get('auth')!, existing, db)) {
        err = { error: 'forbidden', status: 403 }
        return db
      }
      return writePackAndSync(db, applyPieces(existing, { photos: [photo] }))
    })
    if (err) return c.json({ error: err.error }, err.status)
    return c.json({ photo, file: fileFromDb(next, incidentId) })
  })

  app.get('/api/packs/:incidentId/photos/:photoId/url', async (c) => {
    const denied = needAuth(c)
    if (denied) return denied
    if (!storageConfigured()) return c.json({ error: 'storage_unconfigured' }, 503)
    const incidentId = c.req.param('incidentId')
    const photoId = decodeURIComponent(c.req.param('photoId'))
    const db = await load()
    const pack = packFromDb(db, incidentId)
    if (!pack) return c.json({ error: 'not_found' }, 404)
    if (!canSeePack(c.get('auth')!, pack, db)) return c.json({ error: 'forbidden' }, 403)
    const photo = pack.evidence.photos.find((p) => p.photoId === photoId)
    if (!photo?.storagePath) return c.json({ error: 'not_uploaded' }, 404)
    try {
      const url = await signedEvidenceUrl(photo.storagePath)
      return c.json({ url, storagePath: photo.storagePath })
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : 'signed_url' }, 502)
    }
  })

  app.patch('/api/packs/:incidentId', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const patch = await c.req.json<PackPatch>()
    let err: { error: string; status: 404 | 403 } | null = null
    const next = await write((db) => {
      const existing = packFromDb(db, incidentId)
      if (!existing) {
        err = { error: 'not_found', status: 404 }
        return db
      }
      if (!canSeePack(c.get('auth')!, existing, db)) {
        err = { error: 'forbidden', status: 403 }
        return db
      }
      return writePackAndSync(db, mergePack(existing, patch))
    })
    if (err) return c.json({ error: err.error }, err.status)
    return c.json(packFromDb(next, incidentId))
  })

  app.post('/api/packs/:incidentId/pieces', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    const pieces = await c.req.json<EvidencePieces>()
    let err: { error: string; status: 404 | 403 } | null = null
    const next = await write((db) => {
      const existing = packFromDb(db, incidentId)
      if (!existing) {
        err = { error: 'not_found', status: 404 }
        return db
      }
      if (!canSeePack(c.get('auth')!, existing, db)) {
        err = { error: 'forbidden', status: 403 }
        return db
      }
      return writePackAndSync(db, applyPieces(existing, pieces))
    })
    if (err) return c.json({ error: err.error }, err.status)
    return c.json(fileFromDb(next, incidentId))
  })

  app.post('/api/packs', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const auth = c.get('auth')!
    const body = await readJson<CreatePackInput>(c, {})
    let created: EvidencePack | null = null
    let err: string | null = null
    await write((db) => {
      const pack = newEmptyPack(db, {
        ...body,
        motoristId: auth.motoristId!,
        policyId: auth.policyId ?? body.policyId,
      })
      if ('error' in pack) {
        err = pack.error
        return db
      }
      created = pack
      return writePackAndSync(db, pack)
    })
    if (err || !created) return c.json({ error: err ?? 'pack_failed' }, 404)
    return c.json(created, 201)
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
    let out: { declaration: Declaration; dossier: Db['dossiers'][number] } | null = null
    let err: { error: string; status: 404 | 403 | 409 } | null = null
    await write((db) => {
      const pack = packFromDb(db, incidentId)
      if (!pack) {
        err = { error: 'pack_not_found', status: 404 }
        return db
      }
      if (!canSeePack(c.get('auth')!, pack, db)) {
        err = { error: 'forbidden', status: 403 }
        return db
      }
      const existing = db.declarations.find((d) => d.incidentId === incidentId)
      if (existing?.submittedAt) {
        err = { error: 'already_submitted', status: 409 }
        return db
      }
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
      out = { declaration, dossier }
      return writeDossier(db, pack, declaration, dossier)
    })
    if (err) return c.json({ error: err.error }, err.status)
    return c.json(out)
  })

  app.post('/api/declarations/:incidentId/submit', async (c) => {
    const denied = needMotorist(c)
    if (denied) return denied
    const incidentId = c.req.param('incidentId')
    let out: {
      declaration: Declaration
      dossier: Db['dossiers'][number]
      blocked?: boolean
    } | null = null
    let err: { error: string; status: 404 | 403 | 409 } | null = null
    await write((db) => {
      const pack = packFromDb(db, incidentId)
      if (!pack) {
        err = { error: 'pack_not_found', status: 404 }
        return db
      }
      if (!canSeePack(c.get('auth')!, pack, db)) {
        err = { error: 'forbidden', status: 403 }
        return db
      }
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
      if (declaration.submittedAt) {
        err = { error: 'already_submitted', status: 409 }
        return db
      }
      if (!canSubmit(pack.evidence)) {
        const policy = db.policies.find((p) => p.id === pack.incident.policyId)
        const draft = dossierAfterDraft(declaration.id, pack, policy?.number ?? null)
        const dossier = {
          id: db.dossiers.find((d) => d.declarationId === declaration.id)?.id ?? randomUUID(),
          ...draft,
        }
        out = { declaration, dossier, blocked: true }
        return writeDossier(db, pack, declaration, dossier)
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
      out = { declaration: submitted, dossier }
      return writeDossier(db, pack, submitted, dossier)
    })
    if (err) return c.json({ error: err.error }, err.status)
    if (!out) return c.json({ error: 'submit_failed' }, 500)
    if (out.blocked) {
      return c.json(
        { error: 'blocked_missing_evidence', declaration: out.declaration, dossier: out.dossier },
        409,
      )
    }
    return c.json({ declaration: out.declaration, dossier: out.dossier })
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
    // Opt-in only. Never open because NODE_ENV is unset on serverless.
    if (process.env.ALLOW_RESET !== '1') {
      return c.json({ error: 'reset_disabled' }, 403)
    }
    const db = emptyDb()
    await replace(db)
    return c.json({ ok: true })
  })

  return app
}

