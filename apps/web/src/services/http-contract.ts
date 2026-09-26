import type {
  Contact,
  Declaration,
  Dossier,
  Evidence,
  EvidencePack,
  Incident,
  OtherParty,
  Profile,
} from '@/domain/types.ts'
import type { AuthSession, AuthUser } from '@/domain/auth.ts'
import type { DeskBundle, DocumentRequestPiece, MessageIntent } from '@/domain/desk.ts'

export type DeclarationBundle = {
  declaration: Declaration
  dossier: Dossier
}

export type CreatePackInput = {
  motoristId?: string
  policyId?: string
  injury?: Incident['injury']
  vehicleImmobilised?: boolean
  city?: string | null
  workCommute?: boolean | null
  /** Preferred human ref (`ACC-…`). Server falls back to id-derived. */
  ref?: string
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
  dossier: Dossier | null
}

export type SessionSnapshot = {
  profile: Profile
  packs: EvidencePack[]
  files: IncidentFile[]
}

export type SignupInput = {
  role: AuthUser['role']
  email: string
  password: string
  displayName: string
}

export type SigninInput = {
  email: string
  password: string
}

export type RegisteredBroker = {
  id: string
  displayName: string
  email: string
  phone: string | null
  avatarPhotoPath: string | null
}

export type BrokerProfile = {
  firstName: string
  lastName: string
  phone: string
  email: string
  displayName: string
  avatarPhotoPath: string | null
}

export type BrokerProfileSaveResult = BrokerProfile & {
  user: AuthUser
}

export type BrokerClient = {
  motoristId: string
  name: string
  phone: string | null
  email: string | null
  policyNumber: string | null
  plate: string | null
  accountDeleted: boolean
}

/** Contract shared with `@labas/api` Hono API. */
export type LabasHttpApi = {
  signUp: (input: SignupInput) => Promise<AuthSession>
  signIn: (input: SigninInput) => Promise<AuthSession>
  refresh: () => Promise<AuthSession>
  me: () => Promise<AuthUser>
  /** Soft-delete the signed-in account. */
  deleteAccount: () => Promise<{ ok: true }>
  getSession: (motoristId?: string) => Promise<SessionSnapshot>
  getProfile: (motoristId?: string) => Promise<Profile>
  saveProfile: (profile: Profile & { brokerAutoAssignAck?: boolean }) => Promise<Profile>
  completeProfile: () => Promise<AuthSession>
  uploadProfileDoc: (
    kind: 'license' | 'carteGrise' | 'attestation' | 'avatar',
    dataUrl: string,
  ) => Promise<{ kind: string; path: string }>
  profileDocUrl: (
    kind: 'license' | 'carteGrise' | 'attestation' | 'avatar',
  ) => Promise<{ url: string; path: string }>
  loadDemoProfile: () => Promise<Profile>
  listContacts: (
    assistanceOnContract: Profile['policy']['assistanceOnContract'],
  ) => Promise<Contact[]>
  listPacks: (motoristId?: string) => Promise<EvidencePack[]>
  createPack: (input?: CreatePackInput) => Promise<EvidencePack>
  getPack: (incidentId: string) => Promise<EvidencePack>
  savePack: (pack: EvidencePack) => Promise<EvidencePack>
  patchPack: (incidentId: string, patch: PackPatch) => Promise<EvidencePack>
  addPieces: (incidentId: string, pieces: EvidencePieces) => Promise<IncidentFile>
  uploadPhoto: (
    incidentId: string,
    input: {
      slot: string
      dataUrl: string
      zoneId?: string | null
      label?: string
      photoId?: string
      capturedAt?: string | null
    },
  ) => Promise<{ photo: Evidence['photos'][number]; file: IncidentFile }>
  photoSignedUrl: (
    incidentId: string,
    photoId: string,
  ) => Promise<{ url: string; storagePath: string }>
  getFile: (incidentId: string) => Promise<IncidentFile>
  saveDeclarationDraft: (
    incidentId: string,
    draft: Partial<Declaration>,
  ) => Promise<DeclarationBundle>
  submitDeclaration: (incidentId: string) => Promise<DeclarationBundle>
  getDossier: (declarationId: string) => Promise<Dossier>
  getDossierByIncident: (incidentId: string) => Promise<Dossier>
  listBrokerQueue: () => Promise<DeskBundle[]>
  listBrokerClients: () => Promise<BrokerClient[]>
  listRegisteredBrokers: () => Promise<RegisteredBroker[]>
  getBrokerProfile: () => Promise<BrokerProfile>
  saveBrokerProfile: (input: {
    firstName: string
    lastName: string
    phone: string
    avatarPhotoPath?: string | null
  }) => Promise<BrokerProfileSaveResult>
  uploadBrokerAvatar: (dataUrl: string) => Promise<{ path: string }>
  brokerAvatarUrl: () => Promise<{ url: string; path: string }>
  registeredBrokerAvatarUrl: (brokerId: string) => Promise<{ url: string; path: string }>
  brokerMotoristAvatarUrl: (motoristId: string) => Promise<{ url: string; path: string }>
  getBrokerDossier: (dossierId: string) => Promise<DeskBundle>
  requestBrokerPiece: (
    dossierId: string,
    piece: DocumentRequestPiece,
    note: string,
  ) => Promise<DeskBundle>
  createBrokerDraft: (
    dossierId: string,
    intent: MessageIntent,
    pieceLabel?: string,
  ) => Promise<DeskBundle>
  setBrokerDraftApproved: (
    dossierId: string,
    draftId: string,
    humanApproved: boolean,
  ) => Promise<DeskBundle>
  approveBrokerDraft: (dossierId: string, draftId: string) => Promise<DeskBundle>
  setBrokerDraftBody: (dossierId: string, draftId: string, body: string) => Promise<DeskBundle>
  setBrokerOwner: (dossierId: string, owner: string) => Promise<DeskBundle>
  toggleBrokerTask: (dossierId: string, taskId: string) => Promise<DeskBundle>
  handoffBrokerDossier: (dossierId: string) => Promise<DeskBundle>
  reset: () => Promise<void>
  getImportMode: () => Promise<{ mode: 'live' | 'fixture' }>
  startImportSession: (input: {
    source: 'TRT' | 'OuiAssur'
    consent: true
    fixtureOutcome?: 'new' | 'duplicate' | 'conflict' | 'interrupted'
  }) => Promise<{ sessionId: string; mode: 'live' | 'fixture' }>
  getImportSession: (sessionId: string) => Promise<ImportSessionPublic>
  resumeImportSession: (
    sessionId: string,
    action: 'continue' | 'cancel',
  ) => Promise<ImportSessionPublic>
  confirmImportSession: (
    sessionId: string,
    resolutions?: { field: string; choice: 'current' | 'incoming' }[],
  ) => Promise<{ bundle: DeskBundle; created: boolean }>
  cancelImportSession: (sessionId: string) => Promise<ImportSessionPublic>
}

export type ImportSessionPublic = {
  id: string
  source: 'TRT' | 'OuiAssur'
  mode: 'live' | 'fixture'
  status:
    | 'running'
    | 'human_gate'
    | 'await_confirm'
    | 'merged'
    | 'interrupted'
    | 'cancelled'
  steps: { at: string; kind: string; message: string }[]
  humanGate: { reason: string; reasonCode: string } | null
  extracted: {
    name: string
    phone: string | null
    policy: string
    vehicle: string | null
    plate: string | null
    city: string | null
  } | null
  classification: {
    outcome: 'new' | 'duplicate' | 'conflict' | 'interrupted'
    matchDossierId: string | null
    reason: string | null
  } | null
  mappingRows: {
    field: string
    label: string
    current: string
    incoming: string
    status: string
  }[]
  mergedDossierId: string | null
  createdAt: string
}
