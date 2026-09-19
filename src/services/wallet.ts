import type { AssistanceOnContract, Profile as DomainProfile } from '@/domain/types.ts'

export type Wallet = {
  onboarded: boolean
  /** Resume index into Phase 1 onboarding steps (0-based). */
  onboardingStep: number
  motoristId: string
  vehicleId: string
  insurerId: string
  brokerId: string
  policyId: string
  name: string
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
  /** Local-only data URL — never uploaded. */
  licensePhotoLocal: string
  /** Local-only data URL — never uploaded. */
  carteGrisePhotoLocal: string
  /** Local-only data URL — never uploaded. */
  attestationPhotoLocal: string
  /** ISO date YYYY-MM-DD when attestation expires. */
  attestationValidUntil: string
  /** Mock OTP verified on this device (Phase 1). */
  phoneVerified: boolean
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
  name: '',
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
  attestationValidUntil: '',
  phoneVerified: false,
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
  if (!isLegacySharedWallet(wallet)) return wallet
  const fresh = createDeviceWallet()
  return {
    ...fresh,
    name: wallet.name,
    phone: wallet.phone,
    plate: wallet.plate,
    vehicle: wallet.vehicle,
    insurer: wallet.insurer,
    policy: wallet.policy,
    broker: wallet.broker,
    brokerId: wallet.brokerId,
    brokerPhone: wallet.brokerPhone,
    assistanceNumber: wallet.assistanceNumber,
    assistanceOnContract: wallet.assistanceOnContract,
    city: wallet.city,
    cin: wallet.cin,
    licenseNumber: wallet.licenseNumber,
    licensePhotoLocal: wallet.licensePhotoLocal,
    carteGrisePhotoLocal: wallet.carteGrisePhotoLocal,
    attestationPhotoLocal: wallet.attestationPhotoLocal,
    attestationValidUntil: wallet.attestationValidUntil,
    phoneVerified: wallet.phoneVerified,
    onboardingStep: wallet.onboardingStep,
    onboarded: wallet.onboarded,
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
  'name',
  'phone',
  'cin',
  'city',
  'plate',
  'vehicle',
  'insurer',
  'policy',
  'brokerId',
] as const satisfies ReadonlyArray<keyof Wallet>

export function walletFieldFilled(profile: Wallet, key: keyof Wallet): boolean {
  return String(profile[key] ?? '').trim().length > 0
}

/** Share of claim-ready fields still missing (0–100). */
export function walletRemainingPercent(profile: Wallet): number {
  const filled = CLAIM_READY_FIELDS.filter((key) => walletFieldFilled(profile, key)).length
  const done = filled / CLAIM_READY_FIELDS.length
  return Math.max(0, Math.round((1 - done) * 100))
}

export function walletEssentialsFilled(profile: Wallet): boolean {
  return walletRemainingPercent(profile) === 0
}

/** True when profile + courtier are complete enough to open LATER / send claim. */
export function walletClaimReady(profile: Wallet): boolean {
  return walletEssentialsFilled(profile)
}

export function walletToDomain(wallet: Wallet): DomainProfile {
  const assistanceOnContract: AssistanceOnContract = wallet.assistanceNumber.trim()
    ? 'yes'
    : wallet.assistanceOnContract
  return {
    motorist: {
      id: wallet.motoristId,
      name: wallet.name.trim(),
      phone: wallet.phone.trim() || null,
      alsoTellEmployerIfCommute: false,
    },
    vehicle: {
      id: wallet.vehicleId,
      plate: wallet.plate.trim() || null,
      makeModel: wallet.vehicle.trim() || null,
    },
    insurer: {
      id: wallet.insurerId,
      displayName: wallet.insurer.trim() || 'Assureur',
    },
    broker: {
      id: wallet.brokerId,
      displayName: wallet.broker.trim() || 'Courtier',
    },
    policy: {
      id: wallet.policyId,
      number: wallet.policy.trim() || null,
      insurerId: wallet.insurerId,
      brokerId: wallet.brokerId,
      vehicleId: wallet.vehicleId,
      assistanceOnContract,
    },
  }
}

export function domainToWallet(profile: DomainProfile, extra?: Partial<Wallet>): Wallet {
  return {
    ...emptyWallet,
    ...extra,
    onboarded: true,
    motoristId: profile.motorist.id,
    vehicleId: profile.vehicle.id,
    insurerId: profile.insurer.id,
    brokerId: profile.broker.id,
    policyId: profile.policy.id,
    name: profile.motorist.name,
    phone: profile.motorist.phone ?? '',
    plate: profile.vehicle.plate ?? '',
    vehicle: profile.vehicle.makeModel ?? '',
    insurer: profile.insurer.displayName,
    policy: profile.policy.number ?? '',
    broker: profile.broker.displayName,
    assistanceOnContract: profile.policy.assistanceOnContract,
  }
}
