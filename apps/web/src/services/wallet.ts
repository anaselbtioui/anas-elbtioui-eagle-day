import {
  isMoroccanCin,
  isMoroccanPlate,
  isPersonName,
} from '@/domain/ma-fields.ts'
import { isMoroccanCity } from '@/domain/moroccan-cities.ts'
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

/** Broader portefeuille fields for drawer progress (onboarding surface). */
export const PORTEFEUILLE_PROGRESS_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'cin',
  'city',
  'plate',
  'vehicle',
  'insurer',
  'policy',
  'brokerId',
  'licenseNumber',
  'attestationValidUntil',
] as const satisfies ReadonlyArray<keyof Wallet>

/** Provision placeholder. Not a real insurer the motorist chose. */
export const PLACEHOLDER_INSURER = 'Assureur'

export function walletFieldFilled(profile: Wallet, key: keyof Wallet): boolean {
  if (key === 'phoneVerified') return profile.phoneVerified
  if (key === 'assistanceOnContract') return profile.assistanceOnContract !== 'unknown'
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

/** Share of portefeuille progress still missing (0–100). */
export function walletRemainingPercent(profile: Wallet): number {
  const missing = walletMissingProgressFields(profile).length
  const phoneGap = profile.phoneVerified ? 0 : 1
  const total = PORTEFEUILLE_PROGRESS_FIELDS.length + 1
  return Math.max(0, Math.min(100, Math.round(((missing + phoneGap) / total) * 100)))
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
  return {
    motorist: {
      id: wallet.motoristId,
      name: displayName(wallet),
      phone: wallet.phone.trim() || null,
      alsoTellEmployerIfCommute: false,
      cin: wallet.cin.trim() || null,
      city: wallet.city.trim() || null,
      licenseNumber: wallet.licenseNumber.trim() || null,
      licensePhotoPath: wallet.licensePhotoPath.trim() || null,
      carteGrisePhotoPath: wallet.carteGrisePhotoPath.trim() || null,
      attestationPhotoPath: wallet.attestationPhotoPath.trim() || null,
    },
    vehicle: {
      id: wallet.vehicleId,
      plate: wallet.plate.trim() || null,
      makeModel: wallet.vehicle.trim() || null,
    },
    insurer: {
      id: wallet.insurerId,
      displayName: wallet.insurer.trim() || PLACEHOLDER_INSURER,
    },
    broker: {
      id: wallet.brokerId,
      displayName: wallet.broker.trim() || 'Courtier',
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
  const split = migrateWalletNames({
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
    insurer: profile.insurer.displayName,
    policy: profile.policy.number ?? '',
    broker: profile.broker.displayName,
    assistanceOnContract: profile.policy.assistanceOnContract,
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
  }
}
