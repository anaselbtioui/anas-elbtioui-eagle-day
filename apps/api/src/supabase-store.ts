import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Broker,
  Contact,
  Declaration,
  Dossier,
  Evidence,
  Incident,
  Insurer,
  Motorist,
  OtherParty,
  Policy,
  Profile,
  Vehicle,
} from '@labas/domain/types.ts'
import type { AppUserRecord } from '@labas/domain/auth.ts'
import type { Db } from './store.ts'
import type { DeskFile } from './desk.ts'
import { withWriteLock } from './write-lock.ts'

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function client(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function throwIf(error: { message: string } | null, action: string): void {
  if (error) throw new Error(`${action}: ${error.message}`)
}

type AppUserRow = {
  id: string
  email: string
  password_hash: string
  role: AppUserRecord['role']
  display_name: string
  onboarded: boolean
  motorist_id: string | null
  broker_id: string | null
  vehicle_id: string | null
  insurer_id: string | null
  policy_id: string | null
  deleted_at: string | null
}

function mapAppUserRow(r: AppUserRow): AppUserRecord {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role,
    displayName: r.display_name,
    onboarded: r.onboarded,
    motoristId: r.motorist_id,
    brokerId: r.broker_id,
    vehicleId: r.vehicle_id,
    insurerId: r.insurer_id,
    policyId: r.policy_id,
    deletedAt: r.deleted_at ?? null,
  }
}

/** Targeted auth lookup — JWT is valid only while this row exists and is not soft-deleted. */
export async function fetchAppUserById(id: string): Promise<AppUserRecord | null> {
  const sb = client()
  const { data, error } = await sb.from('app_users').select('*').eq('id', id).maybeSingle()
  throwIf(error, 'select app_user')
  if (!data) return null
  const row = mapAppUserRow(data as AppUserRow)
  return row.deletedAt ? null : row
}

let memoryCache: { db: Db; at: number } | null = null
/** In-process cache — auth middleware + routes used to reload all tables per hop. */
const CACHE_TTL_MS = 3_000

export function invalidateDbCache(): void {
  memoryCache = null
}

export async function loadDb(): Promise<Db> {
  if (memoryCache && Date.now() - memoryCache.at < CACHE_TTL_MS) {
    return memoryCache.db
  }
  const sb = client()
  const tables = [
    'insurers',
    'brokers',
    'motorists',
    'vehicles',
    'policies',
    'other_parties',
    'incidents',
    'evidences',
    'declarations',
    'dossiers',
    'contacts',
    'desk_files',
    'app_users',
  ] as const
  const settled = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await sb.from(table).select('*')
      throwIf(error, `select ${table}`)
      return [table, data ?? []] as const
    }),
  )
  const rows: Record<string, unknown[]> = Object.fromEntries(settled)

  const db: Db = {
    insurers: (rows.insurers as { id: string; display_name: string }[]).map((r) => ({
      id: r.id,
      displayName: r.display_name,
    })),
    brokers: (
      rows.brokers as {
        id: string
        display_name: string
        first_name?: string | null
        last_name?: string | null
        phone?: string | null
        avatar_photo_path?: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      displayName: r.display_name,
      firstName: r.first_name ?? null,
      lastName: r.last_name ?? null,
      phone: r.phone ?? null,
      avatarPhotoPath: r.avatar_photo_path ?? null,
    })),
    motorists: (
      rows.motorists as {
        id: string
        name: string
        first_name?: string | null
        last_name?: string | null
        phone: string | null
        also_tell_employer_if_commute: boolean
        cin?: string | null
        city?: string | null
        license_number?: string | null
        license_photo_path?: string | null
        carte_grise_photo_path?: string | null
        attestation_photo_path?: string | null
        avatar_photo_path?: string | null
        assistance_number?: string | null
        broker_phone?: string | null
        onboarding_step?: number | null
        updated_at?: string | null
        broker_auto_assigned_at?: string | null
        broker_auto_assigned_ack_at?: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      firstName: r.first_name ?? null,
      lastName: r.last_name ?? null,
      phone: r.phone,
      alsoTellEmployerIfCommute: r.also_tell_employer_if_commute,
      cin: r.cin ?? null,
      city: r.city ?? null,
      licenseNumber: r.license_number ?? null,
      licensePhotoPath: r.license_photo_path ?? null,
      carteGrisePhotoPath: r.carte_grise_photo_path ?? null,
      attestationPhotoPath: r.attestation_photo_path ?? null,
      avatarPhotoPath: r.avatar_photo_path ?? null,
      assistanceNumber: r.assistance_number ?? null,
      brokerPhone: r.broker_phone ?? null,
      onboardingStep: r.onboarding_step ?? 0,
      updatedAt: r.updated_at ?? null,
      brokerAutoAssignedAt: r.broker_auto_assigned_at ?? null,
      brokerAutoAssignedAckAt: r.broker_auto_assigned_ack_at ?? null,
    })),
    vehicles: (rows.vehicles as { id: string; plate: string | null; make_model: string | null }[]).map(
      (r) => ({
        id: r.id,
        plate: r.plate,
        makeModel: r.make_model,
      }),
    ),
    policies: (
      rows.policies as {
        id: string
        number: string | null
        insurer_id: string
        broker_id: string | null
        vehicle_id: string
        assistance_on_contract: Policy['assistanceOnContract']
        attestation_valid_until?: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      number: r.number,
      insurerId: r.insurer_id,
      brokerId: r.broker_id,
      vehicleId: r.vehicle_id,
      assistanceOnContract: r.assistance_on_contract,
      attestationValidUntil: r.attestation_valid_until ?? null,
    })),
    otherParties: (
      rows.other_parties as {
        id: string
        status: OtherParty['status']
        name: string | null
        plate: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      status: r.status,
      name: r.name,
      plate: r.plate,
    })),
    incidents: (
      rows.incidents as {
        id: string
        ref: string | null
        motorist_id: string
        policy_id: string | null
        occurred_at: string | null
        city: string | null
        injury: Incident['injury']
        vehicle_immobilised: boolean
        other_party_id: string | null
        work_commute: boolean | null
        archived_at: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      ref: r.ref?.trim() || `ACC-${r.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`,
      motoristId: r.motorist_id,
      policyId: r.policy_id,
      occurredAt: r.occurred_at,
      city: r.city,
      injury: r.injury,
      vehicleImmobilised: r.vehicle_immobilised,
      otherPartyId: r.other_party_id,
      workCommute: r.work_commute,
      archivedAt: r.archived_at,
    })),
    evidences: (
      rows.evidences as {
        incident_id: string
        constat: Evidence['constat']
        pv: Evidence['pv']
        damage_zones: Evidence['damageZones']
        photos: Evidence['photos']
      }[]
    ).map((r) => ({
      incidentId: r.incident_id,
      constat: r.constat,
      pv: r.pv,
      damageZones: r.damage_zones ?? [],
      photos: r.photos ?? [],
    })),
    declarations: (
      rows.declarations as {
        id: string
        incident_id: string
        narrative: string
        document_refs: Declaration['documentRefs']
        channel: Declaration['channel']
        submitted_at: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      incidentId: r.incident_id,
      narrative: r.narrative,
      documentRefs: r.document_refs ?? [],
      channel: r.channel,
      submittedAt: r.submitted_at,
    })),
    dossiers: (
      rows.dossiers as {
        id: string
        declaration_id: string
        missing_pieces: Dossier['missingPieces']
        status: Dossier['status']
        next_human_step: string
        notified_within_guidance_note: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      declarationId: r.declaration_id,
      missingPieces: r.missing_pieces ?? [],
      status: r.status,
      nextHumanStep: r.next_human_step,
      notifiedWithinGuidanceNote: r.notified_within_guidance_note,
    })),
    contacts: (
      rows.contacts as {
        id: string
        role: Contact['role']
        display_name: string
        phone: string | null
        url: string | null
        note: string
      }[]
    ).map((r) => ({
      id: r.id,
      role: r.role,
      displayName: r.display_name,
      phone: r.phone,
      url: r.url,
      note: r.note,
    })),
    deskFiles: (
      (rows.desk_files ?? []) as {
        dossier_id: string
        title: string
        source: string
        freshness: string
        owner: string
        tasks: DeskFile['tasks']
        requests: DeskFile['requests']
        drafts: DeskFile['drafts']
        events?: DeskFile['events']
      }[]
    ).map((r) => ({
      dossierId: r.dossier_id,
      title: r.title,
      provenance: {
        source: r.source,
        freshness: r.freshness,
        owner: r.owner,
      },
      tasks: r.tasks ?? [],
      requests: r.requests ?? [],
      drafts: r.drafts ?? [],
      events: r.events ?? [],
    })),
    users: ((rows.app_users ?? []) as AppUserRow[]).map(mapAppUserRow),
  }
  memoryCache = { db, at: Date.now() }
  return db
}

async function upsertAll<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  table: string,
  rows: T[],
  onConflict: string,
): Promise<void> {
  if (!rows.length) return
  const { error } = await sb.from(table).upsert(rows, { onConflict })
  throwIf(error, `upsert ${table}`)
}

function dossierRow(r: Dossier) {
  return {
    id: r.id,
    declaration_id: r.declarationId,
    missing_pieces: r.missingPieces,
    status: r.status,
    next_human_step: r.nextHumanStep,
    notified_within_guidance_note: r.notifiedWithinGuidanceNote,
  }
}

function evidenceRow(r: Evidence) {
  return {
    incident_id: r.incidentId,
    constat: r.constat,
    pv: r.pv,
    damage_zones: r.damageZones,
    photos: r.photos,
  }
}

function deskFileRow(r: DeskFile) {
  return {
    dossier_id: r.dossierId,
    title: r.title,
    source: r.provenance.source,
    freshness: r.provenance.freshness,
    owner: r.provenance.owner,
    tasks: r.tasks,
    requests: r.requests,
    drafts: r.drafts,
    events: r.events ?? [],
  }
}

/** Row-level write — avoids whole-table wipe for hot paths. */
export async function upsertDossierRow(dossier: Dossier): Promise<void> {
  invalidateDbCache()
  await withWriteLock(async () => {
    const sb = client()
    await upsertAll(sb, 'dossiers', [dossierRow(dossier)], 'id')
  })
}

/** Row-level write — avoids whole-table wipe for hot paths. */
export async function upsertEvidenceRow(evidence: Evidence): Promise<void> {
  invalidateDbCache()
  await withWriteLock(async () => {
    const sb = client()
    await upsertAll(sb, 'evidences', [evidenceRow(evidence)], 'incident_id')
  })
}

/** Row-level write — avoids whole-table wipe for hot paths. */
export async function upsertDeskFileRow(file: DeskFile): Promise<void> {
  invalidateDbCache()
  await withWriteLock(async () => {
    const sb = client()
    await upsertAll(sb, 'desk_files', [deskFileRow(file)], 'dossier_id')
  })
}

async function wipeAllTables(sb: SupabaseClient): Promise<void> {
  // Children before parents (FK order).
  const wipeById = [
    'app_users',
    'desk_files',
    'dossiers',
    'declarations',
    'evidences',
    'incidents',
    'other_parties',
    'policies',
    'vehicles',
    'motorists',
    'brokers',
    'insurers',
    'contacts',
  ]
  for (const table of wipeById) {
    const idCol = table === 'evidences' ? 'incident_id' : table === 'desk_files' ? 'dossier_id' : 'id'
    const { error } = await sb.from(table).delete().neq(idCol, '__none__')
    throwIf(error, `wipe ${table}`)
  }
}

/** Normal writes: upsert only. Never delete-all (serverless races emptied prod). */
/** Do not nest withWriteLock — exclusiveDbWrite already holds that chain. */
export async function saveDb(db: Db): Promise<void> {
  invalidateDbCache()
  await upsertAllTables(db)
  memoryCache = { db, at: Date.now() }
}

/** Gated full replace — /api/reset only. */
export async function replaceDb(db: Db): Promise<void> {
  invalidateDbCache()
  const sb = client()
  await wipeAllTables(sb)
  await upsertAllTables(db)
  memoryCache = { db, at: Date.now() }
}

/**
 * Upsert every table, parallel within an FK tier, tiers in order.
 * 6 round trips instead of 16 sequential ones.
 */
async function upsertAllTables(db: Db): Promise<void> {
  const sb = client()

  // Tier 1: no foreign keys.
  await Promise.all([
    upsertAll(
      sb,
      'insurers',
      db.insurers.map((r: Insurer) => ({ id: r.id, display_name: r.displayName })),
      'id',
    ),
    upsertAll(
      sb,
      'brokers',
      db.brokers.map((r: Broker) => ({
        id: r.id,
        display_name: r.displayName,
        first_name: r.firstName,
        last_name: r.lastName,
        phone: r.phone,
        avatar_photo_path: r.avatarPhotoPath,
      })),
      'id',
    ),
    upsertAll(
      sb,
      'motorists',
      db.motorists.map((r: Motorist) => ({
        id: r.id,
        name: r.name,
        first_name: r.firstName,
        last_name: r.lastName,
        phone: r.phone,
        also_tell_employer_if_commute: r.alsoTellEmployerIfCommute,
        cin: r.cin,
        city: r.city,
        license_number: r.licenseNumber,
        license_photo_path: r.licensePhotoPath,
        carte_grise_photo_path: r.carteGrisePhotoPath,
        attestation_photo_path: r.attestationPhotoPath,
        avatar_photo_path: r.avatarPhotoPath,
        assistance_number: r.assistanceNumber,
        broker_phone: r.brokerPhone,
        onboarding_step: r.onboardingStep,
        updated_at: r.updatedAt,
        broker_auto_assigned_at: r.brokerAutoAssignedAt,
        broker_auto_assigned_ack_at: r.brokerAutoAssignedAckAt,
      })),
      'id',
    ),
    upsertAll(
      sb,
      'vehicles',
      db.vehicles.map((r: Vehicle) => ({
        id: r.id,
        plate: r.plate,
        make_model: r.makeModel,
      })),
      'id',
    ),
    upsertAll(
      sb,
      'other_parties',
      db.otherParties.map((r: OtherParty) => ({
        id: r.id,
        status: r.status,
        name: r.name,
        plate: r.plate,
      })),
      'id',
    ),
    upsertAll(
      sb,
      'contacts',
      db.contacts.map((r: Contact) => ({
        id: r.id,
        role: r.role,
        display_name: r.displayName,
        phone: r.phone,
        url: r.url,
        note: r.note,
      })),
      'id',
    ),
  ])

  // Tier 2: policies -> insurers, brokers, vehicles.
  await upsertAll(
    sb,
    'policies',
    db.policies.map((r: Policy) => ({
      id: r.id,
      number: r.number,
      insurer_id: r.insurerId,
      broker_id: r.brokerId,
      vehicle_id: r.vehicleId,
      assistance_on_contract: r.assistanceOnContract,
      attestation_valid_until: r.attestationValidUntil,
    })),
    'id',
  )

  // Tier 3: incidents -> motorists, policies, other_parties; app_users -> tier 1 + policies.
  await Promise.all([
    upsertAll(
      sb,
      'incidents',
      db.incidents.map((r: Incident) => ({
        id: r.id,
        ref: r.ref,
        motorist_id: r.motoristId,
        policy_id: r.policyId,
        occurred_at: r.occurredAt,
        city: r.city,
        injury: r.injury,
        vehicle_immobilised: r.vehicleImmobilised,
        other_party_id: r.otherPartyId,
        work_commute: r.workCommute,
        archived_at: r.archivedAt,
      })),
      'id',
    ),
    upsertAll(
      sb,
      'app_users',
      db.users.map((r) => ({
        id: r.id,
        email: r.email,
        password_hash: r.passwordHash,
        role: r.role,
        display_name: r.displayName,
        onboarded: r.onboarded,
        motorist_id: r.motoristId,
        broker_id: r.brokerId,
        vehicle_id: r.vehicleId,
        insurer_id: r.insurerId,
        policy_id: r.policyId,
        deleted_at: r.deletedAt,
      })),
      'id',
    ),
  ])

  // Tier 4: evidences, declarations -> incidents.
  await Promise.all([
    upsertAll(sb, 'evidences', db.evidences.map(evidenceRow), 'incident_id'),
    upsertAll(
      sb,
      'declarations',
      db.declarations.map((r: Declaration) => ({
        id: r.id,
        incident_id: r.incidentId,
        narrative: r.narrative,
        document_refs: r.documentRefs,
        channel: r.channel,
        submitted_at: r.submittedAt,
      })),
      'id',
    ),
  ])

  // Tier 5: dossiers -> declarations. Tier 6: desk_files -> dossiers.
  await upsertAll(sb, 'dossiers', db.dossiers.map(dossierRow), 'id')
  await upsertAll(sb, 'desk_files', db.deskFiles.map(deskFileRow), 'dossier_id')
}

function mapMotoristRow(r: {
  id: string
  name: string
  first_name?: string | null
  last_name?: string | null
  phone: string | null
  also_tell_employer_if_commute: boolean
  cin?: string | null
  city?: string | null
  license_number?: string | null
  license_photo_path?: string | null
  carte_grise_photo_path?: string | null
  attestation_photo_path?: string | null
  avatar_photo_path?: string | null
  assistance_number?: string | null
  broker_phone?: string | null
  onboarding_step?: number | null
  updated_at?: string | null
  broker_auto_assigned_at?: string | null
  broker_auto_assigned_ack_at?: string | null
}): Motorist {
  return {
    id: r.id,
    name: r.name,
    firstName: r.first_name ?? null,
    lastName: r.last_name ?? null,
    phone: r.phone,
    alsoTellEmployerIfCommute: r.also_tell_employer_if_commute,
    cin: r.cin ?? null,
    city: r.city ?? null,
    licenseNumber: r.license_number ?? null,
    licensePhotoPath: r.license_photo_path ?? null,
    carteGrisePhotoPath: r.carte_grise_photo_path ?? null,
    attestationPhotoPath: r.attestation_photo_path ?? null,
    avatarPhotoPath: r.avatar_photo_path ?? null,
    assistanceNumber: r.assistance_number ?? null,
    brokerPhone: r.broker_phone ?? null,
    onboardingStep: r.onboarding_step ?? 0,
    updatedAt: r.updated_at ?? null,
    brokerAutoAssignedAt: r.broker_auto_assigned_at ?? null,
    brokerAutoAssignedAckAt: r.broker_auto_assigned_ack_at ?? null,
  }
}

/** Targeted GET — motorist + linked vehicle/insurer/broker/policy only. */
export async function fetchProfileById(motoristId: string): Promise<Profile | null> {
  const sb = client()
  const { data: mRow, error: mErr } = await sb
    .from('motorists')
    .select('*')
    .eq('id', motoristId)
    .maybeSingle()
  throwIf(mErr, 'select motorist')
  if (!mRow) return null
  const motorist = mapMotoristRow(mRow as Parameters<typeof mapMotoristRow>[0])

  const { data: user, error: uErr } = await sb
    .from('app_users')
    .select('policy_id, vehicle_id, insurer_id, broker_id')
    .eq('motorist_id', motoristId)
    .is('deleted_at', null)
    .maybeSingle()
  throwIf(uErr, 'select app_user')
  if (!user?.policy_id || !user.vehicle_id || !user.insurer_id) return null

  const [{ data: policy, error: pErr }, { data: vehicle, error: vErr }, { data: insurer, error: iErr }] =
    await Promise.all([
      sb.from('policies').select('*').eq('id', user.policy_id).maybeSingle(),
      sb.from('vehicles').select('*').eq('id', user.vehicle_id).maybeSingle(),
      sb.from('insurers').select('*').eq('id', user.insurer_id).maybeSingle(),
    ])
  throwIf(pErr, 'select policy')
  throwIf(vErr, 'select vehicle')
  throwIf(iErr, 'select insurer')
  if (!policy || !vehicle || !insurer) return null

  let broker = {
    id: '',
    displayName: '',
    firstName: null as string | null,
    lastName: null as string | null,
    phone: null as string | null,
    avatarPhotoPath: null as string | null,
  }
  const brokerId = (policy.broker_id as string | null) || user.broker_id
  if (brokerId) {
    const { data: b, error: bErr } = await sb.from('brokers').select('*').eq('id', brokerId).maybeSingle()
    throwIf(bErr, 'select broker')
    if (b) {
      broker = {
        id: b.id,
        displayName: b.display_name,
        firstName: b.first_name ?? null,
        lastName: b.last_name ?? null,
        phone: b.phone ?? null,
        avatarPhotoPath: b.avatar_photo_path ?? null,
      }
    }
  }

  return {
    motorist,
    vehicle: { id: vehicle.id, plate: vehicle.plate, makeModel: vehicle.make_model },
    insurer: { id: insurer.id, displayName: insurer.display_name },
    broker,
    policy: {
      id: policy.id,
      number: policy.number,
      insurerId: policy.insurer_id,
      brokerId: policy.broker_id,
      vehicleId: policy.vehicle_id,
      assistanceOnContract: policy.assistance_on_contract,
      attestationValidUntil: policy.attestation_valid_until ?? null,
    },
  }
}

/** Targeted write — only motorist profile tables (no whole-DB upsert). */
export async function upsertProfileEntities(profile: Profile): Promise<void> {
  invalidateDbCache()
  await withWriteLock(() => upsertProfileEntitiesUnlocked(profile))
}

/** Call only while already holding the write lock (e.g. inside exclusiveDbWrite). */
export async function upsertAppUserUnlocked(user: AppUserRecord): Promise<void> {
  invalidateDbCache()
  const sb = client()
  await upsertAll(
    sb,
    'app_users',
    [
      {
        id: user.id,
        email: user.email,
        password_hash: user.passwordHash,
        role: user.role,
        display_name: user.displayName,
        onboarded: user.onboarded,
        motorist_id: user.motoristId,
        broker_id: user.brokerId,
        vehicle_id: user.vehicleId,
        insurer_id: user.insurerId,
        policy_id: user.policyId,
        deleted_at: user.deletedAt,
      },
    ],
    'id',
  )
}

/** Call only while already holding the write lock (e.g. inside exclusiveDbWrite). */
export async function upsertProfileEntitiesUnlocked(profile: Profile): Promise<void> {
  invalidateDbCache()
  const sb = client()
  await Promise.all([
    upsertAll(
      sb,
      'motorists',
      [
        {
          id: profile.motorist.id,
          name: profile.motorist.name,
          first_name: profile.motorist.firstName,
          last_name: profile.motorist.lastName,
          phone: profile.motorist.phone,
          also_tell_employer_if_commute: profile.motorist.alsoTellEmployerIfCommute,
          cin: profile.motorist.cin,
          city: profile.motorist.city,
          license_number: profile.motorist.licenseNumber,
          license_photo_path: profile.motorist.licensePhotoPath,
          carte_grise_photo_path: profile.motorist.carteGrisePhotoPath,
          attestation_photo_path: profile.motorist.attestationPhotoPath,
          avatar_photo_path: profile.motorist.avatarPhotoPath,
          assistance_number: profile.motorist.assistanceNumber,
          broker_phone: profile.motorist.brokerPhone,
          onboarding_step: profile.motorist.onboardingStep,
          updated_at: profile.motorist.updatedAt,
          broker_auto_assigned_at: profile.motorist.brokerAutoAssignedAt,
          broker_auto_assigned_ack_at: profile.motorist.brokerAutoAssignedAckAt,
        },
      ],
      'id',
    ),
    upsertAll(
      sb,
      'vehicles',
      [
        {
          id: profile.vehicle.id,
          plate: profile.vehicle.plate,
          make_model: profile.vehicle.makeModel,
        },
      ],
      'id',
    ),
    upsertAll(
      sb,
      'insurers',
      [
        {
          id: profile.insurer.id,
          display_name: profile.insurer.displayName === 'Assureur' ? '' : profile.insurer.displayName,
        },
      ],
      'id',
    ),
  ])
  await upsertAll(
    sb,
    'policies',
    [
      {
        id: profile.policy.id,
        number: profile.policy.number,
        insurer_id: profile.policy.insurerId,
        broker_id: profile.policy.brokerId,
        vehicle_id: profile.policy.vehicleId,
        assistance_on_contract: profile.policy.assistanceOnContract,
        attestation_valid_until: profile.policy.attestationValidUntil,
      },
    ],
    'id',
  )
}
