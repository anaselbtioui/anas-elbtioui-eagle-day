export type Injury = 'no' | 'yes' | 'unknown'
export type OtherPartyStatus = 'known' | 'unknown' | 'refused' | 'fled'
export type AssistanceOnContract = 'yes' | 'no' | 'unknown'
export type ConstatStatus = 'absent' | 'started' | 'complete'
export type PvStatus = 'not_needed' | 'required' | 'obtained'
export type PhotoSlot = 'scene' | 'part' | 'corner' | 'other'
export type ContactRole = 'authorities' | 'assistance' | 'insurer_general' | 'broker'
export type DeclarationChannel = 'broker' | 'insurer_direct'
export type DocumentKind = 'constat' | 'pv' | 'photo' | 'other'
export type MissingPiece = 'constat_or_pv' | 'photos' | 'policy_number' | 'other'
export type DossierStatus =
  | 'draft'
  | 'blocked_missing_evidence'
  | 'declared'
  | 'waiting_motorist'
  | 'with_broker'
  | 'with_insurer'

export type Motorist = {
  id: string
  name: string
  /** Preferred over splitting `name` when set. */
  firstName: string | null
  lastName: string | null
  phone: string | null
  alsoTellEmployerIfCommute: boolean
  /** Moroccan CIN / identity number. */
  cin: string | null
  /** Residence city (curated list). */
  city: string | null
  licenseNumber: string | null
  /** Supabase Storage path in `evidence` bucket (wallet docs). */
  licensePhotoPath: string | null
  carteGrisePhotoPath: string | null
  attestationPhotoPath: string | null
  /** Circular profile picture in settings / shell avatar. */
  avatarPhotoPath: string | null
  /** Client-only wallet fields persisted server-side. */
  assistanceNumber: string | null
  brokerPhone: string | null
  onboardingStep: number | null
  /** ISO timestamp for optimistic concurrency. */
  updatedAt: string | null
  /** When the server sole-broker auto-link last set the broker. */
  brokerAutoAssignedAt: string | null
  /** When the motorist dismissed the auto-assign notice. */
  brokerAutoAssignedAckAt: string | null
}

/** True until the motorist dismisses the sole-broker auto-link notice. */
export function brokerAutoAssignPending(
  motorist: Pick<Motorist, 'brokerAutoAssignedAt' | 'brokerAutoAssignedAckAt'>,
): boolean {
  return Boolean(motorist.brokerAutoAssignedAt?.trim()) && !motorist.brokerAutoAssignedAckAt?.trim()
}

export type OtherParty = {
  id: string
  status: OtherPartyStatus
  name: string | null
  plate: string | null
}

export type Insurer = {
  id: string
  displayName: string
}

export type Broker = {
  id: string
  displayName: string
}

export type Vehicle = {
  id: string
  plate: string | null
  makeModel: string | null
}

export type Policy = {
  id: string
  number: string | null
  insurerId: string
  brokerId: string | null
  vehicleId: string
  assistanceOnContract: AssistanceOnContract
  /** ISO date YYYY-MM-DD when attestation expires. */
  attestationValidUntil: string | null
}

export type Incident = {
  id: string
  /** Human ref stored without `#`, e.g. `ACC-D791D49E`. */
  ref: string
  motoristId: string
  policyId: string | null
  occurredAt: string | null
  city: string | null
  injury: Injury
  vehicleImmobilised: boolean
  otherPartyId: string | null
  workCommute: boolean | null
  /** ISO timestamp when motorist archived; null = active in récents. */
  archivedAt: string | null
}

export type DamageZone = {
  id: string
  label: string
}

export type PhotoMeta = {
  photoId: string
  slot: PhotoSlot
  zoneId: string | null
  label: string
  capturedAt: string | null
  /** Supabase Storage object path in bucket `evidence`, when uploaded. */
  storagePath?: string | null
}

export type Evidence = {
  incidentId: string
  constat: ConstatStatus
  pv: PvStatus
  damageZones: DamageZone[]
  photos: PhotoMeta[]
}

export type Contact = {
  id: string
  role: ContactRole
  displayName: string
  phone: string | null
  url: string | null
  note: string
}

export type DocumentRef = {
  kind: DocumentKind
  label: string
  present: boolean
}

export type Declaration = {
  id: string
  incidentId: string
  narrative: string
  documentRefs: DocumentRef[]
  channel: DeclarationChannel
  submittedAt: string | null
}

export type Dossier = {
  id: string
  declarationId: string
  missingPieces: MissingPiece[]
  status: DossierStatus
  nextHumanStep: string
  notifiedWithinGuidanceNote: string | null
}

export type Profile = {
  motorist: Motorist
  vehicle: Vehicle
  insurer: Insurer
  broker: Broker
  policy: Policy
}

export type EvidencePack = {
  incident: Incident
  otherParty: OtherParty | null
  evidence: Evidence
}

export const ACAPS_NOTIFY_GUIDANCE =
  'Informer l’assureur rapidement (guidance ACAPS : exemple 5 jours). Ce n’est pas un délai calculé par l’application.'
