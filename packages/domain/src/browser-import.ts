import type { DeskBundle } from './desk.ts'
import { appendEvent } from './desk.ts'
import { accidentRefFromId } from './accident-ref.ts'
import type { EvidencePack, Profile } from './types.ts'
import { ACAPS_NOTIFY_GUIDANCE, stubBroker } from './types.ts'

export type ImportSource = 'TRT' | 'OuiAssur'
export type ImportOutcome = 'new' | 'duplicate' | 'conflict' | 'interrupted'
export type ImportFieldKey = 'name' | 'phone' | 'policy' | 'vehicle' | 'plate' | 'city'
export type MappingStatus = 'Nouveau' | 'Doublon' | 'Conflit' | 'Identique'

export type ExtractedImport = {
  name: string
  phone: string | null
  policy: string
  vehicle: string | null
  plate: string | null
  city: string | null
}

export type MappingRow = {
  field: ImportFieldKey
  label: string
  current: string
  incoming: string
  status: MappingStatus
}

export type FieldResolution = {
  field: ImportFieldKey
  choice: 'current' | 'incoming'
}

export type ClassifyResult = {
  outcome: ImportOutcome
  matchDossierId: string | null
  rows: MappingRow[]
  reason: string | null
}

const FIELD_LABELS: Record<ImportFieldKey, string> = {
  name: 'Client',
  phone: 'Téléphone',
  policy: 'Contrat',
  vehicle: 'Véhicule',
  plate: 'Immatriculation',
  city: 'Ville',
}

const EMPTY = 'Non renseigné'

function norm(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function display(value: string | null | undefined): string {
  const t = (value ?? '').trim()
  return t || EMPTY
}

function profileField(profile: Profile, field: ImportFieldKey): string | null {
  switch (field) {
    case 'name':
      return profile.motorist.name
    case 'phone':
      return profile.motorist.phone
    case 'policy':
      return profile.policy.number
    case 'vehicle':
      return profile.vehicle.makeModel
    case 'plate':
      return profile.vehicle.plate
    case 'city':
      return null
  }
}

function extractedField(extracted: ExtractedImport, field: ImportFieldKey): string | null {
  return extracted[field]
}

export function findBundleByPolicy(
  bundles: DeskBundle[],
  policy: string,
): DeskBundle | undefined {
  const p = norm(policy)
  if (!p) return undefined
  return bundles.find((b) => norm(b.profile.policy.number) === p)
}

export function buildMappingRows(
  extracted: ExtractedImport,
  match: DeskBundle | null,
): MappingRow[] {
  const keys: ImportFieldKey[] = ['name', 'phone', 'policy', 'vehicle', 'plate', 'city']
  return keys.map((field) => {
    const incoming = display(extractedField(extracted, field))
    const current = match
      ? field === 'city'
        ? display(match.pack.incident.city)
        : display(profileField(match.profile, field))
      : EMPTY
    let status: MappingStatus = 'Nouveau'
    if (match) {
      if (norm(current) === norm(incoming)) status = field === 'policy' ? 'Doublon' : 'Identique'
      else if (current !== EMPTY && incoming !== EMPTY && norm(current) !== norm(incoming)) {
        status = 'Conflit'
      } else if (current === EMPTY && incoming !== EMPTY) status = 'Nouveau'
      else status = 'Identique'
    }
    return {
      field,
      label: FIELD_LABELS[field],
      current,
      incoming,
      status,
    }
  })
}

/** Classify extracted portal fields against existing desk bundles. */
export function classifyImport(
  extracted: ExtractedImport | null,
  bundles: DeskBundle[],
  opts?: { forcedOutcome?: ImportOutcome; interruptedReason?: string },
): ClassifyResult {
  if (opts?.forcedOutcome === 'interrupted' || !extracted || !extracted.policy.trim()) {
    return {
      outcome: 'interrupted',
      matchDossierId: null,
      rows: [],
      reason:
        opts?.interruptedReason ??
        'Structure de page inconnue ou extraction incomplète. Aucun champ accepté; reprise manuelle requise.',
    }
  }

  if (opts?.forcedOutcome === 'duplicate' || opts?.forcedOutcome === 'conflict' || opts?.forcedOutcome === 'new') {
    const match =
      opts.forcedOutcome === 'new' ? null : (findBundleByPolicy(bundles, extracted.policy) ?? null)
    const rows = buildMappingRows(extracted, match)
    if (opts.forcedOutcome === 'conflict') {
      return {
        outcome: 'conflict',
        matchDossierId: match?.dossierId ?? null,
        rows: rows.map((r) =>
          r.field === 'phone' || r.field === 'vehicle'
            ? { ...r, status: 'Conflit' as const }
            : r,
        ),
        reason: null,
      }
    }
    if (opts.forcedOutcome === 'duplicate') {
      return {
        outcome: 'duplicate',
        matchDossierId: match?.dossierId ?? null,
        rows: rows.map((r) =>
          r.field === 'policy' || r.field === 'name'
            ? { ...r, status: 'Doublon' as const }
            : r,
        ),
        reason: null,
      }
    }
    return { outcome: 'new', matchDossierId: null, rows, reason: null }
  }

  const match = findBundleByPolicy(bundles, extracted.policy) ?? null
  const rows = buildMappingRows(extracted, match)

  if (!match) {
    return { outcome: 'new', matchDossierId: null, rows, reason: null }
  }

  const conflicts = rows.filter((r) => r.status === 'Conflit')
  if (conflicts.length > 0) {
    return {
      outcome: 'conflict',
      matchDossierId: match.dossierId,
      rows,
      reason: null,
    }
  }

  return {
    outcome: 'duplicate',
    matchDossierId: match.dossierId,
    rows,
    reason: 'Contrat déjà présent: aucun doublon créé.',
  }
}

export function provenanceSource(source: ImportSource): string {
  return `Import navigateur · ${source}`
}

export function createImportBundle(input: {
  extracted: ExtractedImport
  source: ImportSource
  owner: string
  now?: string
}): DeskBundle {
  const now = input.now ?? new Date().toISOString()
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const motoristId = `M-IMP-${suffix}`
  const vehicleId = `V-IMP-${suffix}`
  const policyId = `P-IMP-${suffix}`
  const insurerId = `I-IMP-${suffix}`
  const brokerId = `B-IMP-${suffix}`
  const incidentId = `INC-IMP-${suffix}`
  const declarationId = `DEC-IMP-${suffix}`
  const dossierId = `DOS-IMP-${suffix}`

  const profile: Profile = {
    motorist: {
      id: motoristId,
      name: input.extracted.name.trim() || 'Client importé',
      firstName: null,
      lastName: null,
      phone: input.extracted.phone,
      alsoTellEmployerIfCommute: false,
      cin: null,
      city: input.extracted.city,
      licenseNumber: null,
      licensePhotoPath: null,
      carteGrisePhotoPath: null,
      attestationPhotoPath: null,
      avatarPhotoPath: null,
      assistanceNumber: null,
      brokerPhone: null,
      onboardingStep: 0,
      updatedAt: now,
      brokerAutoAssignedAt: null,
      brokerAutoAssignedAckAt: null,
    },
    vehicle: {
      id: vehicleId,
      plate: input.extracted.plate,
      makeModel: input.extracted.vehicle,
    },
    insurer: { id: insurerId, displayName: 'Assureur (import)' },
    broker: stubBroker(brokerId, input.owner || 'Courtier'),
    policy: {
      id: policyId,
      number: input.extracted.policy.trim(),
      insurerId,
      brokerId,
      vehicleId,
      assistanceOnContract: 'unknown',
      attestationValidUntil: null,
    },
  }

  const pack: EvidencePack = {
    incident: {
      id: incidentId,
      ref: accidentRefFromId(incidentId),
      motoristId,
      policyId,
      occurredAt: null,
      city: input.extracted.city,
      injury: 'unknown',
      vehicleImmobilised: false,
      otherPartyId: null,
      workCommute: null,
      archivedAt: null,
    },
    otherParty: null,
    evidence: {
      incidentId,
      constat: 'absent',
      pv: 'not_needed',
      damageZones: [],
      photos: [],
    },
  }

  const city = input.extracted.city?.trim() || 'Sans ville'
  const bundle: DeskBundle = {
    dossierId,
    title: `Contrat importé · ${city}`,
    profile,
    pack,
    declaration: {
      id: declarationId,
      incidentId,
      narrative: `Import navigateur depuis ${input.source}. Aucune déclaration de sinistre.`,
      documentRefs: [],
      channel: 'broker',
      submittedAt: null,
    },
    dossier: {
      id: dossierId,
      declarationId,
      missingPieces: ['other'],
      status: 'with_broker',
      nextHumanStep: 'Vérifier les champs importés. Aucune décision de garantie.',
      notifiedWithinGuidanceNote: ACAPS_NOTIFY_GUIDANCE,
      closedAt: null,
      closedReason: null,
    },
    provenance: {
      source: provenanceSource(input.source),
      freshness: now,
      owner: input.owner || 'À attribuer',
    },
    tasks: [
      {
        id: `T-${dossierId}-verify`,
        label: 'Vérifier les champs importés',
        done: false,
      },
    ],
    requests: [],
    drafts: [],
    events: [
      {
        id: `EVT-${dossierId}-import`,
        at: now,
        actor: 'system',
        label: `Import accepté localement · ${input.source}`,
        motoristVisible: false,
      },
    ],
  }
  return bundle
}

function applyResolutionToProfile(
  profile: Profile,
  extracted: ExtractedImport,
  resolutions: FieldResolution[],
): Profile {
  const pick = (field: ImportFieldKey, current: string | null, incoming: string | null) => {
    const res = resolutions.find((r) => r.field === field)
    if (!res) return current
    return res.choice === 'incoming' ? incoming : current
  }
  return {
    ...profile,
    motorist: {
      ...profile.motorist,
      name: pick('name', profile.motorist.name, extracted.name) ?? profile.motorist.name,
      phone: pick('phone', profile.motorist.phone, extracted.phone),
    },
    vehicle: {
      ...profile.vehicle,
      makeModel: pick('vehicle', profile.vehicle.makeModel, extracted.vehicle),
      plate: pick('plate', profile.vehicle.plate, extracted.plate),
    },
    policy: {
      ...profile.policy,
      number: pick('policy', profile.policy.number, extracted.policy),
    },
  }
}

export type MergeImportInput = {
  classification: ClassifyResult
  extracted: ExtractedImport
  source: ImportSource
  owner: string
  bundles: DeskBundle[]
  resolutions?: FieldResolution[]
  now?: string
}

export type MergeImportResult =
  | { ok: true; bundle: DeskBundle; created: boolean }
  | { ok: false; reason: string }

/** Apply human-confirmed merge. Duplicate / interrupted always fail. */
export function mergeImport(input: MergeImportInput): MergeImportResult {
  const { classification, extracted, source, owner, bundles, resolutions = [], now } =
    input
  if (classification.outcome === 'interrupted') {
    return { ok: false, reason: classification.reason ?? 'interrupted' }
  }
  if (classification.outcome === 'duplicate') {
    return {
      ok: false,
      reason: classification.reason ?? 'Contrat déjà présent: aucun doublon créé.',
    }
  }
  if (classification.outcome === 'new') {
    return {
      ok: true,
      created: true,
      bundle: createImportBundle({ extracted, source, owner, now }),
    }
  }

  // conflict
  const match = bundles.find((b) => b.dossierId === classification.matchDossierId)
  if (!match) return { ok: false, reason: 'match_not_found' }

  const conflictFields = classification.rows
    .filter((r) => r.status === 'Conflit')
    .map((r) => r.field)
  for (const field of conflictFields) {
    if (!resolutions.some((r) => r.field === field)) {
      return { ok: false, reason: 'resolutions_incomplete' }
    }
  }

  const profile = applyResolutionToProfile(match.profile, extracted, resolutions)
  const cityRes = resolutions.find((r) => r.field === 'city')
  const city =
    cityRes?.choice === 'incoming'
      ? extracted.city
      : (match.pack.incident.city ?? extracted.city)

  let bundle: DeskBundle = {
    ...match,
    profile,
    pack: {
      ...match.pack,
      incident: { ...match.pack.incident, city },
    },
    provenance: {
      ...match.provenance,
      source: provenanceSource(source),
      freshness: now ?? new Date().toISOString(),
      owner: owner || match.provenance.owner,
    },
  }
  bundle = appendEvent(
    bundle,
    'broker',
    `Conflit import résolu · ${source}`,
    false,
    now ?? new Date().toISOString(),
  )
  return { ok: true, created: false, bundle }
}

export function mappingBadge(outcome: ImportOutcome): string {
  switch (outcome) {
    case 'new':
      return 'PRÊT À RELIRE'
    case 'duplicate':
      return 'DOUBLON DÉTECTÉ'
    case 'conflict':
      return 'CONFLIT À RÉSOUDRE'
    case 'interrupted':
      return 'INTERROMPU'
  }
}
