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
    brokers: (rows.brokers as { id: string; display_name: string }[]).map((r) => ({
      id: r.id,
      displayName: r.display_name,
    })),
    motorists: (
      rows.motorists as {
        id: string
        name: string
        phone: string | null
        also_tell_employer_if_commute: boolean
        cin?: string | null
        city?: string | null
        license_number?: string | null
        license_photo_path?: string | null
        carte_grise_photo_path?: string | null
        attestation_photo_path?: string | null
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      alsoTellEmployerIfCommute: r.also_tell_employer_if_commute,
      cin: r.cin ?? null,
      city: r.city ?? null,
      licenseNumber: r.license_number ?? null,
      licensePhotoPath: r.license_photo_path ?? null,
      carteGrisePhotoPath: r.carte_grise_photo_path ?? null,
      attestationPhotoPath: r.attestation_photo_path ?? null,
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
    users: (
      (rows.app_users ?? []) as {
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
      }[]
    ).map((r) => ({
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
    })),
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

async function upsertAllTables(db: Db): Promise<void> {
  const sb = client()

  await upsertAll(
    sb,
    'insurers',
    db.insurers.map((r: Insurer) => ({ id: r.id, display_name: r.displayName })),
    'id',
  )
  await upsertAll(
    sb,
    'brokers',
    db.brokers.map((r: Broker) => ({ id: r.id, display_name: r.displayName })),
    'id',
  )
  await upsertAll(
    sb,
    'motorists',
    db.motorists.map((r: Motorist) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      also_tell_employer_if_commute: r.alsoTellEmployerIfCommute,
      cin: r.cin,
      city: r.city,
      license_number: r.licenseNumber,
      license_photo_path: r.licensePhotoPath,
      carte_grise_photo_path: r.carteGrisePhotoPath,
      attestation_photo_path: r.attestationPhotoPath,
    })),
    'id',
  )
  await upsertAll(
    sb,
    'vehicles',
    db.vehicles.map((r: Vehicle) => ({
      id: r.id,
      plate: r.plate,
      make_model: r.makeModel,
    })),
    'id',
  )
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
  await upsertAll(
    sb,
    'other_parties',
    db.otherParties.map((r: OtherParty) => ({
      id: r.id,
      status: r.status,
      name: r.name,
      plate: r.plate,
    })),
    'id',
  )
  await upsertAll(
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
  )
  await upsertAll(
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
  )
  await upsertAll(
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
  )
  await upsertAll(sb, 'dossiers', db.dossiers.map(dossierRow), 'id')
  await upsertAll(sb, 'evidences', db.evidences.map(evidenceRow), 'incident_id')
  await upsertAll(sb, 'desk_files', db.deskFiles.map(deskFileRow), 'dossier_id')
  await upsertAll(
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
    })),
    'id',
  )
}
