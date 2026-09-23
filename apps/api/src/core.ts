import { randomUUID } from 'node:crypto'
import { ensureAccidentRef } from '@labas/domain/accident-ref.ts'
import {
  applyEvidenceRules,
  canSubmit,
  dossierAfterDraft,
  dossierAfterSubmit,
  emptyEvidence,
} from '@labas/domain/rules.ts'
import {
  approveDraft,
  createDraft,
  handoffToInsurer,
  requestDocument,
  setDraftBody,
  setDraftHumanApproved,
  setOwner,
  toggleTask,
  type DeskBundle,
  type DocumentRequestPiece,
  type MessageIntent,
} from '@labas/domain/desk.ts'
import { seedDeskBundles } from '@labas/domain/desk-seed.ts'
import {
  nadiaMissingConstatPack,
  nadiaProfile,
  saraInjuryPack,
  saraMotorist,
} from '@labas/domain/fixtures.ts'
import type {
  Declaration,
  Evidence,
  EvidencePack,
  Incident,
  OtherParty,
  Profile,
} from '@labas/domain/types.ts'
import {
  bundleFromParts,
  defaultDeskFile,
  deskFileFromBundle,
  upsertDeskFile,
  type DeskFile,
} from './desk.ts'
import { emptyDb, upsert, upsertEvidence, type Db } from './store.ts'

export type CreatePackInput = {
  motoristId?: string
  policyId?: string
  injury?: Incident['injury']
  vehicleImmobilised?: boolean
  city?: string | null
  workCommute?: boolean | null
}

export type PackPatch = {
  incident?: Partial<Incident>
  otherParty?: OtherParty | null
  evidence?: Partial<Evidence>
}

export type EvidencePieces = {
  constat?: Evidence['constat']
  pv?: Evidence['pv']
  photos?: Evidence['photos']
  damageZones?: Evidence['damageZones']
}

export type IncidentFile = {
  incidentId: string
  pack: EvidencePack
  declaration: Declaration | null
  dossier: Db['dossiers'][number] | null
}

export function packFromDb(db: Db, incidentId: string): EvidencePack | null {
  const incident = db.incidents.find((i) => i.id === incidentId)
  if (!incident) return null
  const evidence = db.evidences.find((e) => e.incidentId === incidentId)
  if (!evidence) return null
  const otherParty = incident.otherPartyId
    ? (db.otherParties.find((o) => o.id === incident.otherPartyId) ?? null)
    : null
  return applyEvidenceRules({ incident, otherParty, evidence })
}

export function policyForMotorist(db: Db, motoristId: string) {
  const fromIncident = db.incidents.find((i) => i.motoristId === motoristId && i.policyId)
  if (fromIncident?.policyId) {
    const matched = db.policies.find((p) => p.id === fromIncident.policyId)
    if (matched) return matched
  }
  const numbered = db.policies.find((p) => p.id === `P-${motoristId.replace(/^M-/, '')}`)
  if (numbered) return numbered
  if (motoristId === 'M-1') return db.policies.find((p) => p.id === 'P-1') ?? db.policies[0]
  return db.policies.find((p) => p.id !== 'P-1') ?? db.policies[0]
}

export function profileFromDb(db: Db, motoristId: string): Profile | null {
  const motorist = db.motorists.find((m) => m.id === motoristId)
  if (!motorist) return null
  const policy = policyForMotorist(db, motoristId)
  if (!policy) return null
  const vehicle = db.vehicles.find((v) => v.id === policy.vehicleId)
  const insurer = db.insurers.find((i) => i.id === policy.insurerId)
  if (!vehicle || !insurer) return null
  const broker = policy.brokerId
    ? db.brokers.find((b) => b.id === policy.brokerId)
    : undefined
  if (!broker) {
    return {
      motorist,
      vehicle,
      insurer,
      broker: { id: '', displayName: '—' },
      policy: { ...policy, brokerId: null },
    }
  }
  return { motorist, vehicle, insurer, broker, policy }
}

export function listDeskBundlesForBroker(db: Db, brokerId: string): DeskBundle[] {
  return listDeskBundles(db).filter((b) => b.profile.policy.brokerId === brokerId)
}

export function brokerOwnsBundle(bundle: DeskBundle, brokerId: string): boolean {
  return bundle.profile.policy.brokerId === brokerId
}

export function upsertProfile(db: Db, profile: Profile): Db {
  return {
    ...db,
    motorists: upsert(db.motorists, profile.motorist),
    vehicles: upsert(db.vehicles, profile.vehicle),
    insurers: upsert(db.insurers, profile.insurer),
    brokers: upsert(db.brokers, profile.broker),
    policies: upsert(db.policies, profile.policy),
  }
}

export function writePack(db: Db, pack: EvidencePack): Db {
  const next = applyEvidenceRules(pack)
  let otherParties = db.otherParties
  let incident = next.incident
  const taken = new Set(
    db.incidents.filter((i) => i.id !== incident.id).map((i) => i.ref).filter(Boolean),
  )
  incident = {
    ...incident,
    ref: ensureAccidentRef(incident.ref, incident.id, taken),
  }
  if (next.otherParty) {
    otherParties = upsert(otherParties, next.otherParty)
    incident = { ...incident, otherPartyId: next.otherParty.id }
  } else {
    incident = { ...incident, otherPartyId: null }
  }
  return {
    ...db,
    otherParties,
    incidents: upsert(db.incidents, incident),
    evidences: upsertEvidence(db.evidences, { ...next.evidence, incidentId: incident.id }),
  }
}

export function packsForMotorist(db: Db, motoristId: string): EvidencePack[] {
  return db.incidents
    .filter((i) => i.motoristId === motoristId)
    .map((i) => packFromDb(db, i.id))
    .filter((p): p is EvidencePack => p !== null)
    .sort((a, b) => (b.incident.occurredAt ?? '').localeCompare(a.incident.occurredAt ?? ''))
}

export function fileFromDb(db: Db, incidentId: string): IncidentFile | null {
  const pack = packFromDb(db, incidentId)
  if (!pack) return null
  const declaration = db.declarations.find((d) => d.incidentId === incidentId) ?? null
  const dossier = declaration
    ? (db.dossiers.find((d) => d.declarationId === declaration.id) ?? null)
    : null
  return { incidentId, pack, declaration, dossier }
}

export function filesForMotorist(db: Db, motoristId: string): IncidentFile[] {
  return packsForMotorist(db, motoristId)
    .map((p) => fileFromDb(db, p.incident.id))
    .filter((f): f is IncidentFile => f !== null)
}

export function ensureDesk(db: Db, dossier: Db['dossiers'][number], pack: EvidencePack): Db {
  if (db.deskFiles.some((f) => f.dossierId === dossier.id)) return db
  return { ...db, deskFiles: upsertDeskFile(db.deskFiles, defaultDeskFile(dossier, pack)) }
}

export function syncDossier(db: Db, incidentId: string): Db {
  const pack = packFromDb(db, incidentId)
  if (!pack) return db
  const policy = db.policies.find((p) => p.id === pack.incident.policyId)
  let working = db
  let declaration = working.declarations.find((d) => d.incidentId === incidentId)
  // Open desk draft as soon as pack exists for a linked broker — queue must see client work.
  if (!declaration) {
    if (!policy?.brokerId) return db
    declaration = {
      id: randomUUID(),
      incidentId,
      narrative: '',
      documentRefs: [],
      channel: 'broker',
      submittedAt: null,
    }
    working = { ...working, declarations: upsert(working.declarations, declaration) }
  }
  const fields = declaration.submittedAt
    ? dossierAfterSubmit(declaration, pack, policy?.number ?? null)
    : dossierAfterDraft(declaration.id, pack, policy?.number ?? null)
  const existing = working.dossiers.find((d) => d.declarationId === declaration.id)
  let status = fields.status
  let nextHumanStep = fields.nextHumanStep
  const pieceAdded =
    existing?.status === 'waiting_motorist' && canSubmit(pack.evidence)
  if (pieceAdded) {
    status = 'with_broker'
    nextHumanStep =
      'Le courtier reprend le dossier. Aucune décision de garantie ou d’indemnisation.'
  } else if (existing?.status === 'waiting_motorist' && fields.missingPieces.length > 0) {
    status = 'waiting_motorist'
    nextHumanStep = existing.nextHumanStep
  }
  if (existing?.status === 'with_insurer') {
    status = 'with_insurer'
    nextHumanStep = existing.nextHumanStep
  }
  const dossier = {
    id: existing?.id ?? randomUUID(),
    ...fields,
    status,
    nextHumanStep,
  }
  let next: Db = { ...working, dossiers: upsert(working.dossiers, dossier) }
  next = ensureDesk(next, dossier, pack)
  if (pieceAdded) {
    const file =
      next.deskFiles.find((f) => f.dossierId === dossier.id) ?? defaultDeskFile(dossier, pack)
    const now = new Date().toISOString()
    const withEvent = {
      ...file,
      events: [
        {
          id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          at: now,
          actor: 'motorist' as const,
          label: 'Pièce ajoutée',
          motoristVisible: true,
        },
        ...file.events,
      ],
    }
    next = { ...next, deskFiles: upsertDeskFile(next.deskFiles, withEvent) }
  }
  return next
}

export function writePackAndSync(db: Db, pack: EvidencePack): Db {
  return syncDossier(writePack(db, pack), pack.incident.id)
}

export function mergePack(existing: EvidencePack, patch: PackPatch): EvidencePack {
  const incident: Incident = {
    ...existing.incident,
    ...patch.incident,
    id: existing.incident.id,
    ref: existing.incident.ref,
    motoristId: existing.incident.motoristId,
  }
  let otherParty = existing.otherParty
  if (patch.otherParty === null) {
    otherParty = null
    incident.otherPartyId = null
  } else if (patch.otherParty) {
    otherParty = patch.otherParty
    incident.otherPartyId = patch.otherParty.id
  }
  const evidence: Evidence = {
    ...existing.evidence,
    ...patch.evidence,
    incidentId: existing.incident.id,
  }
  return applyEvidenceRules({ incident, otherParty, evidence })
}

export function applyPieces(existing: EvidencePack, pieces: EvidencePieces): EvidencePack {
  const photos = pieces.photos
    ? dedupePhotos([...existing.evidence.photos, ...pieces.photos])
    : existing.evidence.photos
  return applyEvidenceRules({
    ...existing,
    evidence: {
      ...existing.evidence,
      constat: pieces.constat ?? existing.evidence.constat,
      pv: pieces.pv ?? existing.evidence.pv,
      damageZones: pieces.damageZones ?? existing.evidence.damageZones,
      photos,
    },
  })
}

function dedupePhotos(photos: Evidence['photos']): Evidence['photos'] {
  const byId = new Map<string, Evidence['photos'][number]>()
  for (const photo of photos) {
    const prev = byId.get(photo.photoId)
    if (!prev) {
      byId.set(photo.photoId, photo)
      continue
    }
    byId.set(photo.photoId, {
      ...prev,
      ...photo,
      storagePath: photo.storagePath ?? prev.storagePath ?? null,
    })
  }
  return [...byId.values()]
}

/** Keep Storage paths when a full PUT replaces photo metadata without blobs. */
export function preservePhotoStorage(
  existing: EvidencePack | null,
  next: EvidencePack,
): EvidencePack {
  if (!existing?.evidence.photos.length) return next
  const prevById = new Map(existing.evidence.photos.map((p) => [p.photoId, p]))
  return {
    ...next,
    evidence: {
      ...next.evidence,
      photos: next.evidence.photos.map((p) => {
        const prev = prevById.get(p.photoId)
        if (!prev?.storagePath || p.storagePath) return p
        return { ...p, storagePath: prev.storagePath }
      }),
    },
  }
}

export function assembleBundle(db: Db, dossierId: string): DeskBundle | null {
  const dossier = db.dossiers.find((d) => d.id === dossierId)
  if (!dossier) return null
  const declaration = db.declarations.find((d) => d.id === dossier.declarationId) ?? null
  if (!declaration) return null
  const pack = packFromDb(db, declaration.incidentId)
  if (!pack) return null
  const profile = profileFromDb(db, pack.incident.motoristId)
  if (!profile) return null
  const file = db.deskFiles.find((f) => f.dossierId === dossier.id) ?? defaultDeskFile(dossier, pack)
  return bundleFromParts(dossier, pack, profile, declaration, file)
}

export function listDeskBundles(db: Db): DeskBundle[] {
  return db.dossiers
    .map((d) => assembleBundle(db, d.id))
    .filter((b): b is DeskBundle => b !== null)
}

export function persistDeskBundle(db: Db, bundle: DeskBundle): Db {
  const pack: EvidencePack = {
    ...bundle.pack,
    incident: {
      ...bundle.pack.incident,
      policyId: bundle.pack.incident.policyId ?? bundle.profile.policy.id,
    },
  }
  let next = upsertProfile(db, bundle.profile)
  next = writePack(next, pack)
  const declaration: Declaration = bundle.declaration ?? {
    id: bundle.dossier.declarationId,
    incidentId: pack.incident.id,
    narrative: '',
    documentRefs: [],
    channel: 'broker',
    submittedAt: null,
  }
  next = {
    ...next,
    declarations: upsert(next.declarations, declaration),
    dossiers: upsert(next.dossiers, bundle.dossier),
    deskFiles: upsertDeskFile(next.deskFiles, deskFileFromBundle({ ...bundle, pack })),
  }
  return next
}

export function seedDeskDb(base?: Db): Db {
  let db = base ?? emptyDb()
  for (const bundle of seedDeskBundles()) {
    db = persistDeskBundle(db, bundle)
  }
  return db
}

/** Merge Nadia missing-constat pack into existing DB without wiping other motorists. */
export function mergeNadiaDemo(db: Db): Db {
  let next = upsertProfile(db, nadiaProfile)
  next = writePackAndSync(next, nadiaMissingConstatPack())
  return next
}

/** Merge Sara injury pack into existing DB. */
export function mergeSaraDemo(db: Db): Db {
  let next = {
    ...db,
    motorists: upsert(db.motorists, saraMotorist),
  }
  next = writePackAndSync(next, saraInjuryPack())
  return next
}

export function applyRequest(
  db: Db,
  dossierId: string,
  piece: DocumentRequestPiece,
  note: string,
): { db: Db; bundle: DeskBundle } | { error: 'not_found' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const nextBundle = requestDocument(bundle, piece, note)
  return { db: persistDeskBundle(db, nextBundle), bundle: nextBundle }
}

export function applyCreateDraft(
  db: Db,
  dossierId: string,
  intent: MessageIntent,
  pieceLabel?: string,
): { db: Db; bundle: DeskBundle; draftId: string | null } | { error: 'not_found' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const nextBundle = createDraft(bundle, intent, pieceLabel)
  return {
    db: persistDeskBundle(db, nextBundle),
    bundle: nextBundle,
    draftId: nextBundle.drafts[0]?.id ?? null,
  }
}

export function applySetHumanApproved(
  db: Db,
  dossierId: string,
  draftId: string,
  humanApproved: boolean,
): { db: Db; bundle: DeskBundle } | { error: 'not_found' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const nextBundle = setDraftHumanApproved(bundle, draftId, humanApproved)
  return { db: persistDeskBundle(db, nextBundle), bundle: nextBundle }
}

export function applyApproveDraft(
  db: Db,
  dossierId: string,
  draftId: string,
):
  | { db: Db; bundle: DeskBundle }
  | { error: 'not_found' | 'draft_missing' | 'not_human_approved' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const result = approveDraft(bundle, draftId)
  if (!result.ok) return { error: result.reason }
  return { db: persistDeskBundle(db, result.bundle), bundle: result.bundle }
}

export function applyToggleTask(
  db: Db,
  dossierId: string,
  taskId: string,
): { db: Db; bundle: DeskBundle } | { error: 'not_found' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const nextBundle = toggleTask(bundle, taskId)
  return { db: persistDeskBundle(db, nextBundle), bundle: nextBundle }
}

export function applyHandoff(
  db: Db,
  dossierId: string,
): { db: Db; bundle: DeskBundle } | { error: 'not_found' | 'has_gaps' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const result = handoffToInsurer(bundle)
  if ('error' in result) return { error: result.error }
  const withTasks: DeskBundle = {
    ...result,
    tasks: result.tasks.map((t) =>
      t.label.toLowerCase().includes('assureur') ? { ...t, done: true } : t,
    ),
  }
  return { db: persistDeskBundle(db, withTasks), bundle: withTasks }
}

export function applySetDraftBody(
  db: Db,
  dossierId: string,
  draftId: string,
  body: string,
): { db: Db; bundle: DeskBundle } | { error: 'not_found' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const nextBundle = setDraftBody(bundle, draftId, body)
  return { db: persistDeskBundle(db, nextBundle), bundle: nextBundle }
}

export function applySetOwner(
  db: Db,
  dossierId: string,
  owner: string,
): { db: Db; bundle: DeskBundle } | { error: 'not_found' } {
  const bundle = assembleBundle(db, dossierId)
  if (!bundle) return { error: 'not_found' }
  const nextBundle = setOwner(bundle, owner)
  return { db: persistDeskBundle(db, nextBundle), bundle: nextBundle }
}

export function newEmptyPack(db: Db, body: CreatePackInput): EvidencePack | { error: 'no_profile' } {
  const motoristId = body.motoristId
  if (!motoristId) return { error: 'no_profile' }
  const motorist = db.motorists.find((m) => m.id === motoristId)
  if (!motorist) return { error: 'no_profile' }
  const policy = body.policyId
    ? db.policies.find((p) => p.id === body.policyId)
    : policyForMotorist(db, motoristId)
  const id = randomUUID()
  const taken = new Set(db.incidents.map((i) => i.ref).filter(Boolean))
  return applyEvidenceRules({
    incident: {
      id,
      ref: ensureAccidentRef(body.ref, id, taken),
      motoristId,
      policyId: policy?.id ?? null,
      occurredAt: new Date().toISOString(),
      city: body.city ?? null,
      injury: body.injury ?? 'no',
      vehicleImmobilised: body.vehicleImmobilised ?? false,
      otherPartyId: null,
      workCommute: body.workCommute ?? null,
      archivedAt: null,
    },
    otherParty: null,
    evidence: emptyEvidence(id),
  })
}

export type { DeskFile }
