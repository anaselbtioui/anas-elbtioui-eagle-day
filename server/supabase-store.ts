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
} from '../src/domain/types.ts'
import type { AppUserRecord } from '../src/domain/auth.ts'
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

export async function loadDb(): Promise<Db> {
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
  const rows: Record<string, unknown[]> = {}
  for (const table of tables) {
    const { data, error } = await sb.from(table).select('*')
    throwIf(error, `select ${table}`)
    rows[table] = data ?? []
  }

  return {
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
      }[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      alsoTellEmployerIfCommute: r.also_tell_employer_if_commute,
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
      }[]
    ).map((r) => ({
      id: r.id,
      number: r.number,
      insurerId: r.insurer_id,
      brokerId: r.broker_id,
      vehicleId: r.vehicle_id,
      assistanceOnContract: r.assistance_on_contract,
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
        motorist_id: string
        policy_id: string | null
        occurred_at: string | null
        city: string | null
        injury: Incident['injury']
        vehicle_immobilised: boolean
        other_party_id: string | null
        work_commute: boolean | null
      }[]
    ).map((r) => ({
      id: r.id,
      motoristId: r.motorist_id,
      policyId: r.policy_id,
      occurredAt: r.occurred_at,
      city: r.city,
      injury: r.injury,
      vehicleImmobilised: r.vehicle_immobilised,
      otherPartyId: r.other_party_id,
      workCommute: r.work_commute,
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
}

async function insertAll<T extends Record<string, unknown>>(
  sb: SupabaseClient,
  table: string,
  rows: T[],
): Promise<void> {
  if (!rows.length) return
  const { error } = await sb.from(table).insert(rows)
  throwIf(error, `insert ${table}`)
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
  await withWriteLock(async () => {
    const sb = client()
    await upsertAll(sb, 'dossiers', [dossierRow(dossier)], 'id')
  })
}

/** Row-level write — avoids whole-table wipe for hot paths. */
export async function upsertEvidenceRow(evidence: Evidence): Promise<void> {
  await withWriteLock(async () => {
    const sb = client()
    await upsertAll(sb, 'evidences', [evidenceRow(evidence)], 'incident_id')
  })
}

/** Row-level write — avoids whole-table wipe for hot paths. */
export async function upsertDeskFileRow(file: DeskFile): Promise<void> {
  await withWriteLock(async () => {
    const sb = client()
    await upsertAll(sb, 'desk_files', [deskFileRow(file)], 'dossier_id')
  })
}

async function syncUpsertTable(
  sb: SupabaseClient,
  table: string,
  idColumn: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  await upsertAll(sb, table, rows, onConflict)
  const keep = new Set(rows.map((r) => String(r[idColumn])))
  const { data, error } = await sb.from(table).select(idColumn)
  throwIf(error, `select ${table} ids`)
  const stale = ((data ?? []) as Record<string, string>[])
    .map((r) => r[idColumn])
    .filter((id): id is string => Boolean(id) && !keep.has(id))
  for (const id of stale) {
    const { error: delErr } = await sb.from(table).delete().eq(idColumn, id)
    throwIf(delErr, `delete stale ${table}`)
  }
}

export async function saveDb(db: Db): Promise<void> {
  await withWriteLock(() => persistAll(db))
}

async function persistAll(db: Db): Promise<void> {
  const sb = client()
  const { error: wipeUsers } = await sb.from('app_users').delete().neq('id', '__none__')
  throwIf(wipeUsers, 'wipe app_users')
  const wipeById = [
    'declarations',
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
    const { error } = await sb.from(table).delete().neq('id', '__none__')
    throwIf(error, `wipe ${table}`)
  }

  await insertAll(
    sb,
    'insurers',
    db.insurers.map((r: Insurer) => ({ id: r.id, display_name: r.displayName })),
  )
  await insertAll(
    sb,
    'brokers',
    db.brokers.map((r: Broker) => ({ id: r.id, display_name: r.displayName })),
  )
  await insertAll(
    sb,
    'motorists',
    db.motorists.map((r: Motorist) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      also_tell_employer_if_commute: r.alsoTellEmployerIfCommute,
    })),
  )
  await insertAll(
    sb,
    'vehicles',
    db.vehicles.map((r: Vehicle) => ({
      id: r.id,
      plate: r.plate,
      make_model: r.makeModel,
    })),
  )
  await insertAll(
    sb,
    'policies',
    db.policies.map((r: Policy) => ({
      id: r.id,
      number: r.number,
      insurer_id: r.insurerId,
      broker_id: r.brokerId,
      vehicle_id: r.vehicleId,
      assistance_on_contract: r.assistanceOnContract,
    })),
  )
  await insertAll(
    sb,
    'other_parties',
    db.otherParties.map((r: OtherParty) => ({
      id: r.id,
      status: r.status,
      name: r.name,
      plate: r.plate,
    })),
  )
  await insertAll(
    sb,
    'incidents',
    db.incidents.map((r: Incident) => ({
      id: r.id,
      motorist_id: r.motoristId,
      policy_id: r.policyId,
      occurred_at: r.occurredAt,
      city: r.city,
      injury: r.injury,
      vehicle_immobilised: r.vehicleImmobilised,
      other_party_id: r.otherPartyId,
      work_commute: r.workCommute,
    })),
  )
  await insertAll(
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
  )
  await insertAll(
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
  )

  // Hot tables: upsert-by-id (then drop orphans) instead of wipe+insert.
  await syncUpsertTable(
    sb,
    'dossiers',
    'id',
    db.dossiers.map(dossierRow),
    'id',
  )
  await syncUpsertTable(
    sb,
    'evidences',
    'incident_id',
    db.evidences.map(evidenceRow),
    'incident_id',
  )
  await syncUpsertTable(
    sb,
    'desk_files',
    'dossier_id',
    db.deskFiles.map(deskFileRow),
    'dossier_id',
  )

  await insertAll(
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
  )
}
