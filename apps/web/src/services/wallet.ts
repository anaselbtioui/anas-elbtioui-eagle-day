import {
  isMoroccanCin,
  isMoroccanPlate,
  isPersonName,
} from '@/domain/ma-fields.ts'
import { isMoroccanCity } from '@/domain/moroccan-cities.ts'
import type { AssistanceOnContract, Profile as DomainProfile } from '@/domain/types.ts'
import { brokerAutoAssignPending as domainBrokerAutoAssignPending } from '@/domain/types.ts'

export type Wallet = {
  onboarded: boolean
  /** Resume index into Phase 1 onboarding steps (0-based). */
  onboardingStep: number
  motoristId: string
  vehicleId: string
  insurerId: string
  brokerId: string
  policyId: string
  firstName: string
  lastName: string
  phone: string
  plate: string
  vehicle: string
  insurer: string
  policy: string
  broker: string
  brokerPhone: string
  assistanceNumber: string
  assistanceOnContract: AssistanceOnContract
  city: string
  /** Moroccan CIN / identity number. */
  cin: string
  licenseNumber: string
  /** Device preview (data URL or signed URL). */
  licensePhotoLocal: string
  carteGrisePhotoLocal: string
  attestationPhotoLocal: string
  /** Server storage paths (evidence bucket). */
  licensePhotoPath: string
  carteGrisePhotoPath: string
  attestationPhotoPath: string
  /** ISO date YYYY-MM-DD when attestation expires. */
  attestationValidUntil: string
  /** Mock OTP verified on this device (Phase 1). */
  phoneVerified: boolean
  alsoTellEmployerIfCommute: boolean
  /** Server optimistic-concurrency stamp (ISO). */
  updatedAt: string
  /** Server set when sole-broker auto-link ran. */
  brokerAutoAssignedAt: string
  /** Server set when motorist dismissed the auto-assign notice. */
  brokerAutoAssignedAckAt: string
  /** Derived: assigned and not yet acked. */
  brokerAutoAssignPending: boolean
}

/** Empty until signup provisions ids on the user. */
export const emptyWallet: Wallet = {
  onboarded: false,
  onboardingStep: 0,
  motoristId: '',
  vehicleId: '',
  insurerId: '',
  brokerId: '',
  policyId: '',
  firstName: '',
  lastName: '',
  phone: '',
  plate: '',
  vehicle: '',
  insurer: '',
  policy: '',
  broker: '',
  brokerPhone: '',
  assistanceNumber: '',
  assistanceOnContract: 'unknown',
  city: '',
  cin: '',
  licenseNumber: '',
  licensePhotoLocal: '',
  carteGrisePhotoLocal: '',
  attestationPhotoLocal: '',
  licensePhotoPath: '',
  carteGrisePhotoPath: '',
  attestationPhotoPath: '',
  attestationValidUntil: '',
  phoneVerified: false,
  alsoTellEmployerIfCommute: false,
  updatedAt: '',
  brokerAutoAssignedAt: '',
  brokerAutoAssignedAckAt: '',
  brokerAutoAssignPending: false,
}

/** UI / API display: « Prénom Nom ». */
export function displayName(wallet: Pick<Wallet, 'firstName' | 'lastName'>): string {
  return `${wallet.firstName.trim()} ${wallet.lastName.trim()}`.trim()
}

/** Split legacy single `name` into first + last when needed. */
export function migrateWalletNames(
  wallet: Wallet & { name?: string },
): Wallet {
  const legacy = typeof wallet.name === 'string' ? wallet.name.trim() : ''
  let firstName = wallet.firstName?.trim() ?? ''
  let lastName = wallet.lastName?.trim() ?? ''
  if (!firstName && !lastName && legacy) {
    const space = legacy.indexOf(' ')
    if (space < 0) {
      firstName = legacy
      lastName = ''
    } else {
      firstName = legacy.slice(0, space).trim()
      lastName = legacy.slice(space + 1).trim()
    }
  }
  const { name: _drop, ...rest } = wallet as Wallet & { name?: string }
  return { ...emptyWallet, ...rest, firstName, lastName }
}

function uuidSuffix(): string {
  return crypto.randomUUID()
}

/** Fresh device-scoped wallet ids (M-/V-/P-/I-/B- + uuid). */
export function createDeviceWallet(): Wallet {
  return {
    ...emptyWallet,
    motoristId: `M-${uuidSuffix()}`,
    vehicleId: `V-${uuidSuffix()}`,
    insurerId: `I-${uuidSuffix()}`,
    brokerId: '',
    policyId: `P-${uuidSuffix()}`,
  }
}

/** True when signup has not attached account ids yet. */
export function needsDeviceWallet(wallet: Wallet): boolean {
  return !wallet.motoristId
}

/** Seed ids shared across devices before per-device migration (Phase D1). */
export const LEGACY_SHARED_MOTORIST_ID = 'M-1'

export function isLegacySharedWallet(wallet: Wallet): boolean {
  return wallet.motoristId === LEGACY_SHARED_MOTORIST_ID
}

/** Replace shared M-1 wallet with device-scoped ids; keep typed profile fields. */
export function migrateDeviceWallet(wallet: Wallet): Wallet {
  const named = migrateWalletNames(wallet as Wallet & { name?: string })
  if (!isLegacySharedWallet(named)) return named
  const fresh = createDeviceWallet()
  return {
    ...fresh,
    firstName: named.firstName,
    lastName: named.lastName,
    phone: named.phone,
    plate: named.plate,
    vehicle: named.vehicle,
    insurer: named.insurer,
    policy: named.policy,
    broker: named.broker,
    brokerId: named.brokerId,
    brokerPhone: named.brokerPhone,
    assistanceNumber: named.assistanceNumber,
    assistanceOnContract: named.assistanceOnContract,
    city: named.city,
    cin: named.cin,
    licenseNumber: named.licenseNumber,
    licensePhotoLocal: named.licensePhotoLocal,
    carteGrisePhotoLocal: named.carteGrisePhotoLocal,
    attestationPhotoLocal: named.attestationPhotoLocal,
    licensePhotoPath: named.licensePhotoPath,
    carteGrisePhotoPath: named.carteGrisePhotoPath,
    attestationPhotoPath: named.attestationPhotoPath,
    attestationValidUntil: named.attestationValidUntil,
    phoneVerified: named.phoneVerified,
    alsoTellEmployerIfCommute: named.alsoTellEmployerIfCommute,
    updatedAt: named.updatedAt,
    brokerAutoAssignedAt: named.brokerAutoAssignedAt,
    brokerAutoAssignedAckAt: named.brokerAutoAssignedAckAt,
    brokerAutoAssignPending: named.brokerAutoAssignPending,
    onboardingStep: named.onboardingStep,
    onboarded: named.onboarded,
  }
}

/** Days until attestation expiry; null if unset / invalid. */
export function attestationDaysRemaining(validUntil: string, now = new Date()): number | null {
  const raw = validUntil.trim()
  if (!raw) return null
  const end = new Date(`${raw}T23:59:59`)
  if (Number.isNaN(end.getTime())) return null
  const ms = end.getTime() - now.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/** Profile fields required before declaring a sinistre to a broker. */
export const CLAIM_READY_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'cin',
  'city',
  'plate',
  'vehicle',
  'insurer',
  'brokerId',
] as const satisfies ReadonlyArray<keyof Wallet>

/** Broader portefeuille fields for drawer progress (onboarding surface).
 * `policy` is UI-optional and excluded from % / gap resume. */
export const PORTEFEUILLE_PROGRESS_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'cin',
  'city',
  'plate',
  'vehicle',
  'insurer',
  'brokerId',
  'licenseNumber',
  'attestationValidUntil',
] as const satisfies ReadonlyArray<keyof Wallet>

/** Provision placeholder. Not a real insurer the motorist chose. */
export const PLACEHOLDER_INSURER = 'Assureur'

export function walletFieldFilled(profile: Wallet, key: keyof Wallet): boolean {
  if (key === 'phoneVerified') return profile.phoneVerified
  if (key === 'assistanceOnContract') return profile.assistanceOnContract !== 'unknown'
  if (key === 'attestationValidUntil') {
    const days = attestationDaysRemaining(String(profile.attestationValidUntil ?? ''))
    return days !== null && days >= 0
  }
  const value = String(profile[key] ?? '').trim()
  if (!value) return false
  if (key === 'insurer' && value === PLACEHOLDER_INSURER) return false
  if (key === 'broker' && (value === '—' || value === 'Courtier')) return false
  return true
}

/** Filled + format rules for claim gates. */
export function walletFieldValid(profile: Wallet, key: keyof Wallet): boolean {
  if (!walletFieldFilled(profile, key)) return false
  switch (key) {
    case 'firstName':
    case 'lastName':
      return isPersonName(String(profile[key]))
    case 'cin':
      return isMoroccanCin(profile.cin)
    case 'city':
      return isMoroccanCity(profile.city)
    case 'plate':
      return isMoroccanPlate(profile.plate)
    default:
      return true
  }
}

/** Fields still empty for claim-ready (for nudge / later gate). */
export function walletMissingClaimFields(profile: Wallet): Array<(typeof CLAIM_READY_FIELDS)[number]> {
  return CLAIM_READY_FIELDS.filter((key) => !walletFieldValid(profile, key))
}

function walletMissingProgressFields(
  profile: Wallet,
): Array<(typeof PORTEFEUILLE_PROGRESS_FIELDS)[number]> {
  return PORTEFEUILLE_PROGRESS_FIELDS.filter((key) => !walletFieldFilled(profile, key))
}

/** Exported for resume-gaps UI (which fields still empty). */
export function walletMissingFields(
  profile: Wallet,
): Array<(typeof PORTEFEUILLE_PROGRESS_FIELDS)[number]> {
  return walletMissingProgressFields(profile)
}

/** True when portefeuille progress is fully filled (remaining 0%). */
export function walletFullyComplete(profile: Wallet): boolean {
  return walletRemainingPercent(profile) === 0
}

/** Onboarding step ids that hold portefeuille inputs (ordered). */
export const WALLET_GAP_STEPS = [
  'otp',
  'identity',
  'permis',
  'carteGrise',
  'attestation',
  'broker',
] as const

export type WalletGapStepId = (typeof WALLET_GAP_STEPS)[number]

const STEP_FIELDS: Record<WalletGapStepId, ReadonlyArray<keyof Wallet>> = {
  otp: ['phone'],
  identity: ['firstName', 'lastName', 'cin', 'city'],
  permis: ['licenseNumber'],
  carteGrise: ['plate', 'vehicle'],
  attestation: ['insurer', 'attestationValidUntil'],
  broker: ['brokerId'],
}

/** Whether a specific wallet field still needs attention on this profile. */
export function walletFieldNeedsInput(profile: Wallet, key: keyof Wallet): boolean {
  return !walletFieldFilled(profile, key)
}

/** True when `key` counts toward portefeuille progress / gap highlight. */
export function walletFieldIsProgress(
  key: keyof Wallet,
): key is (typeof PORTEFEUILLE_PROGRESS_FIELDS)[number] {
  return (PORTEFEUILLE_PROGRESS_FIELDS as readonly string[]).includes(key)
}

/** True when every field on this wallet step is filled and valid. */
export function walletStepReady(profile: Wallet, stepId: string): boolean {
  const fields = STEP_FIELDS[stepId as WalletGapStepId]
  if (!fields) return true
  return fields.every((key) => walletFieldValid(profile, key))
}

/** Steps that still have at least one missing portefeuille field. */
export function walletIncompleteSteps(profile: Wallet): WalletGapStepId[] {
  return WALLET_GAP_STEPS.filter((step) =>
    STEP_FIELDS[step].some((key) => walletFieldNeedsInput(profile, key)),
  )
}

/**
 * First onboarding step with a gap, or `review` when portefeuille is complete.
 * Skips welcome — used when resuming the wallet drawer.
 */
export function firstWalletGapStep(profile: Wallet): WalletGapStepId | 'review' {
  return walletIncompleteSteps(profile)[0] ?? 'review'
}

/** Share of portefeuille progress still missing (0–100). */
export function walletRemainingPercent(profile: Wallet): number {
  const missing = walletMissingProgressFields(profile).length
  const total = PORTEFEUILLE_PROGRESS_FIELDS.length
  return Math.max(0, Math.min(100, Math.round((missing / total) * 100)))
}

export function walletEssentialsFilled(profile: Wallet): boolean {
  return walletMissingClaimFields(profile).length === 0
}

/** True when profile + courtier are complete enough to open LATER / send claim. */
export function walletClaimReady(profile: Wallet): boolean {
  return walletEssentialsFilled(profile)
}

export function walletToDomain(wallet: Wallet): DomainProfile {
  const assistanceOnContract: AssistanceOnContract = wallet.assistanceNumber.trim()
    ? 'yes'
    : wallet.assistanceOnContract
  const first = wallet.firstName.trim()
  const last = wallet.lastName.trim()
  return {
    motorist: {
      id: wallet.motoristId,
      name: displayName(wallet),
      firstName: first || null,
      lastName: last || null,
      phone: wallet.phone.trim() || null,
      alsoTellEmployerIfCommute: wallet.alsoTellEmployerIfCommute,
      cin: wallet.cin.trim() || null,
      city: wallet.city.trim() || null,
      licenseNumber: wallet.licenseNumber.trim() || null,
      licensePhotoPath: wallet.licensePhotoPath.trim() || null,
      carteGrisePhotoPath: wallet.carteGrisePhotoPath.trim() || null,
      attestationPhotoPath: wallet.attestationPhotoPath.trim() || null,
      assistanceNumber: wallet.assistanceNumber.trim() || null,
      brokerPhone: wallet.brokerPhone.trim() || null,
      onboardingStep: wallet.onboardingStep,
      updatedAt: wallet.updatedAt.trim() || null,
      brokerAutoAssignedAt: wallet.brokerAutoAssignedAt.trim() || null,
      brokerAutoAssignedAckAt: wallet.brokerAutoAssignedAckAt.trim() || null,
    },
    vehicle: {
      id: wallet.vehicleId,
      plate: wallet.plate.trim() || null,
      makeModel: wallet.vehicle.trim() || null,
    },
    insurer: {
      id: wallet.insurerId,
      // Never write the provision placeholder — progress treats it as empty.
      displayName:
        wallet.insurer.trim() === PLACEHOLDER_INSURER ? '' : wallet.insurer.trim(),
    },
    broker: {
      id: wallet.brokerId,
      displayName:
        wallet.broker.trim() === 'Courtier' || wallet.broker.trim() === '—'
          ? ''
          : wallet.broker.trim(),
    },
    policy: {
      id: wallet.policyId,
      number: wallet.policy.trim() || null,
      insurerId: wallet.insurerId,
      brokerId: wallet.brokerId.trim() || null,
      vehicleId: wallet.vehicleId,
      assistanceOnContract,
      attestationValidUntil: wallet.attestationValidUntil.trim() || null,
    },
  }
}

export function domainToWallet(profile: DomainProfile, extra?: Partial<Wallet>): Wallet {
  const fromFields =
    (profile.motorist.firstName?.trim() || profile.motorist.lastName?.trim())
      ? {
          firstName: profile.motorist.firstName?.trim() ?? '',
          lastName: profile.motorist.lastName?.trim() ?? '',
        }
      : null
  const split = fromFields
    ? fromFields
    : migrateWalletNames({
        ...emptyWallet,
        name: profile.motorist.name,
      } as Wallet & { name?: string })
  return {
    ...emptyWallet,
    ...extra,
    motoristId: profile.motorist.id,
    vehicleId: profile.vehicle.id,
    insurerId: profile.insurer.id,
    brokerId: profile.broker.id,
    policyId: profile.policy.id,
    firstName: extra?.firstName ?? split.firstName,
    lastName: extra?.lastName ?? split.lastName,
    phone: profile.motorist.phone ?? '',
    plate: profile.vehicle.plate ?? '',
    vehicle: profile.vehicle.makeModel ?? '',
    insurer:
      profile.insurer.displayName === PLACEHOLDER_INSURER
        ? ''
        : profile.insurer.displayName,
    policy: profile.policy.number ?? '',
    broker:
      profile.broker.displayName === 'Courtier' || profile.broker.displayName === '—'
        ? ''
        : profile.broker.displayName,
    assistanceOnContract: profile.policy.assistanceOnContract,
    alsoTellEmployerIfCommute: profile.motorist.alsoTellEmployerIfCommute,
    city: profile.motorist.city ?? extra?.city ?? '',
    cin: profile.motorist.cin ?? extra?.cin ?? '',
    licenseNumber: profile.motorist.licenseNumber ?? extra?.licenseNumber ?? '',
    licensePhotoPath: profile.motorist.licensePhotoPath ?? extra?.licensePhotoPath ?? '',
    carteGrisePhotoPath:
      profile.motorist.carteGrisePhotoPath ?? extra?.carteGrisePhotoPath ?? '',
    attestationPhotoPath:
      profile.motorist.attestationPhotoPath ?? extra?.attestationPhotoPath ?? '',
    licensePhotoLocal: extra?.licensePhotoLocal ?? '',
    carteGrisePhotoLocal: extra?.carteGrisePhotoLocal ?? '',
    attestationPhotoLocal: extra?.attestationPhotoLocal ?? '',
    attestationValidUntil:
      profile.policy.attestationValidUntil ?? extra?.attestationValidUntil ?? '',
    assistanceNumber:
      profile.motorist.assistanceNumber ?? extra?.assistanceNumber ?? '',
    brokerPhone: profile.motorist.brokerPhone ?? extra?.brokerPhone ?? '',
    onboardingStep:
      profile.motorist.onboardingStep ?? extra?.onboardingStep ?? 0,
    updatedAt: profile.motorist.updatedAt ?? extra?.updatedAt ?? '',
    brokerAutoAssignedAt:
      profile.motorist.brokerAutoAssignedAt ?? extra?.brokerAutoAssignedAt ?? '',
    brokerAutoAssignedAckAt:
      profile.motorist.brokerAutoAssignedAckAt ?? extra?.brokerAutoAssignedAckAt ?? '',
    brokerAutoAssignPending: domainBrokerAutoAssignPending({
      brokerAutoAssignedAt:
        profile.motorist.brokerAutoAssignedAt ?? extra?.brokerAutoAssignedAt ?? null,
      brokerAutoAssignedAckAt:
        profile.motorist.brokerAutoAssignedAckAt ?? extra?.brokerAutoAssignedAckAt ?? null,
    }),
  }
}
