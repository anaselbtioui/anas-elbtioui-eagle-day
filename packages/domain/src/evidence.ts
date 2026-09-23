import { accidentRefFromId } from './accident-ref'

export type InjuryAnswer = 'no' | 'yes' | 'unknown'
export type OtherDriverAnswer = 'cooperates' | 'alone' | 'refuses' | 'fled' | 'unknown'

export type CarPart =
  | 'front'
  | 'frontLeft'
  | 'frontRight'
  | 'left'
  | 'right'
  | 'rear'
  | 'rearLeft'
  | 'rearRight'
  | 'roof'
  | 'hood'
  | 'trunk'

export const CAR_PARTS: CarPart[] = [
  'front',
  'frontLeft',
  'frontRight',
  'left',
  'right',
  'rear',
  'rearLeft',
  'rearRight',
  'roof',
  'hood',
  'trunk',
]

export type PhotoSlotId =
  | 'scene'
  | 'cornerFrontLeft'
  | 'cornerFrontRight'
  | 'cornerRearLeft'
  | 'cornerRearRight'
  | CarPart

export function shouldStopForInjury(injury: InjuryAnswer | null): boolean {
  return injury === 'yes' || injury === 'unknown'
}

export function shouldStopForOtherDriver(other: OtherDriverAnswer | null): boolean {
  return other === 'refuses' || other === 'fled' || other === 'unknown'
}

export function nextNowStep(args: {
  injury: InjuryAnswer | null
  otherDriver: OtherDriverAnswer | null
}): 'stop' | 'constat' | 'injury' | 'other' {
  if (args.injury === null) return 'injury'
  if (shouldStopForInjury(args.injury)) return 'stop'
  if (args.otherDriver === null) return 'other'
  if (shouldStopForOtherDriver(args.otherDriver)) return 'stop'
  return 'constat'
}

export function photoSlotsForParts(parts: CarPart[]): PhotoSlotId[] {
  const corners: PhotoSlotId[] = [
    'scene',
    'cornerFrontLeft',
    'cornerFrontRight',
    'cornerRearLeft',
    'cornerRearRight',
  ]
  return [...corners, ...parts]
}

export type EvidencePackStatus = 'draft' | 'saved' | 'stopped' | 'expired'

/** Scene window for unfinished NOW drafts (4h from createdAt). */
export const NOW_DRAFT_TTL_MS = 4 * 60 * 60 * 1000

/**
 * ACAPS example for informing the insurer (5 days from the accident).
 * Display only. Does not change pack status and is not a legal bar.
 */
export const DECLARE_GUIDANCE_WINDOW_MS = 5 * 24 * 60 * 60 * 1000

export function isDeclareGuidanceExpired(
  createdAt: string | undefined,
  now = Date.now(),
): boolean {
  if (!createdAt) return false
  const created = Date.parse(createdAt)
  if (Number.isNaN(created)) return false
  return now > created + DECLARE_GUIDANCE_WINDOW_MS
}

export type NowWizardStep =
  | 'injury'
  | 'stop'
  | 'other'
  | 'constat'
  | 'car'
  | 'photos'
  | 'drive'
  | 'assist'
  | 'saved'
  | 'expired'

export function isNowDraftExpired(
  pack: Pick<EvidencePack, 'status' | 'createdAt'>,
  now = Date.now(),
): boolean {
  if (pack.status !== 'draft') return false
  const created = Date.parse(pack.createdAt)
  if (Number.isNaN(created)) return false
  return now > created + NOW_DRAFT_TTL_MS
}

/** Flip draft → expired when past TTL; otherwise unchanged. */
export function expireDraftPack(pack: EvidencePack, now = Date.now()): EvidencePack {
  if (!isNowDraftExpired(pack, now)) return pack
  return {
    ...pack,
    status: 'expired',
    updatedAt: new Date(now).toISOString(),
  }
}

export function isPackArchived(pack: Pick<EvidencePack, 'archivedAt'>): boolean {
  return Boolean(pack.archivedAt)
}

/** Manual archive: closed flows only (stopped, expired, or draft past TTL). */
export function canArchivePack(
  pack: Pick<EvidencePack, 'status' | 'createdAt' | 'archivedAt'>,
  now = Date.now(),
): boolean {
  if (isPackArchived(pack)) return false
  if (pack.status === 'stopped' || pack.status === 'expired') return true
  return isNowDraftExpired(pack, now)
}

/** Resume wizard step from pack fields (avoids always restarting at injury). */
export function deriveNowStep(pack: EvidencePack): NowWizardStep {
  if (pack.status === 'expired') return 'expired'
  if (pack.status === 'stopped' || pack.stopReason) return 'stop'
  if (pack.status === 'saved') return 'saved'
  if (pack.injury === null) return 'injury'
  if (shouldStopForInjury(pack.injury)) return 'stop'
  if (pack.otherDriver === null) return 'other'
  if (shouldStopForOtherDriver(pack.otherDriver)) return 'stop'

  const leftConstat =
    pack.damagedParts.length > 0 ||
    Object.keys(pack.photos).length > 0 ||
    pack.driveable !== null ||
    pack.assistanceShown
  if (!leftConstat) return 'constat'
  if (pack.damagedParts.length === 0) return 'car'

  const slots = photoSlotsForParts(pack.damagedParts)
  if (slots.some((slot) => !pack.photos[slot])) return 'photos'
  if (pack.driveable === null) return 'drive'
  if (pack.driveable === false) return 'assist'
  return 'saved'
}

export interface EvidencePack {
  id: string
  /** Human ref without `#` (`ACC-…`). UUID stays in `id`. */
  ref: string
  status: EvidencePackStatus
  createdAt: string
  updatedAt: string
  /** Snapshot of motorist city when pack started / last saved. */
  city: string | null
  injury: InjuryAnswer | null
  otherDriver: OtherDriverAnswer | null
  constat: {
    otherName: string
    otherPlate: string
    otherPhone: string
    otherInsurer: string
    notes: string
    attestedDocsChecked: boolean
  }
  damagedParts: CarPart[]
  photos: Partial<Record<PhotoSlotId, string>>
  driveable: boolean | null
  assistanceShown: boolean
  stopReason: 'injury' | 'other' | null
  /** Device-local archive stamp; null = still in working lists. */
  archivedAt: string | null
}

export function createEmptyPack(): EvidencePack {
  const now = new Date().toISOString()
  const id = `PACK-${Date.now()}`
  return {
    id,
    ref: accidentRefFromId(id),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    city: null,
    injury: null,
    otherDriver: null,
    constat: {
      otherName: '',
      otherPlate: '',
      otherPhone: '',
      otherInsurer: '',
      notes: '',
      attestedDocsChecked: false,
    },
    damagedParts: [],
    photos: {},
    driveable: null,
    assistanceShown: false,
    stopReason: null,
    archivedAt: null,
  }
}

export type EvidenceAction =
  | { type: 'SET_INJURY'; injury: InjuryAnswer }
  | { type: 'SET_OTHER'; otherDriver: OtherDriverAnswer }
  | { type: 'SET_CONSTAT'; constat: Partial<EvidencePack['constat']> }
  | { type: 'TOGGLE_PART'; part: CarPart }
  | { type: 'SET_PHOTO'; slot: PhotoSlotId; dataUrl: string }
  | { type: 'CLEAR_PHOTO'; slot: PhotoSlotId }
  | { type: 'SET_DRIVEABLE'; driveable: boolean }
  | { type: 'SHOW_ASSISTANCE' }
  | { type: 'SAVE' }
  | { type: 'STOP'; reason: 'injury' | 'other' }

export function evidenceReducer(state: EvidencePack, action: EvidenceAction): EvidencePack {
  const touch = { updatedAt: new Date().toISOString() }
  switch (action.type) {
    case 'SET_INJURY': {
      const stop = shouldStopForInjury(action.injury)
      return {
        ...state,
        ...touch,
        injury: action.injury,
        stopReason: stop ? 'injury' : state.stopReason,
        status: stop ? 'stopped' : state.status,
      }
    }
    case 'SET_OTHER': {
      const stop = shouldStopForOtherDriver(action.otherDriver)
      return {
        ...state,
        ...touch,
        otherDriver: action.otherDriver,
        stopReason: stop ? 'other' : state.stopReason,
        status: stop ? 'stopped' : state.status,
      }
    }
    case 'SET_CONSTAT':
      return { ...state, ...touch, constat: { ...state.constat, ...action.constat } }
    case 'TOGGLE_PART': {
      const has = state.damagedParts.includes(action.part)
      return {
        ...state,
        ...touch,
        damagedParts: has
          ? state.damagedParts.filter((p) => p !== action.part)
          : [...state.damagedParts, action.part],
      }
    }
    case 'SET_PHOTO':
      return {
        ...state,
        ...touch,
        photos: { ...state.photos, [action.slot]: action.dataUrl },
      }
    case 'CLEAR_PHOTO': {
      const next = { ...state.photos }
      delete next[action.slot]
      return { ...state, ...touch, photos: next }
    }
    case 'SET_DRIVEABLE':
      return { ...state, ...touch, driveable: action.driveable }
    case 'SHOW_ASSISTANCE':
      return { ...state, ...touch, assistanceShown: true }
    case 'SAVE':
      return { ...state, ...touch, status: 'saved' }
    case 'STOP':
      return { ...state, ...touch, status: 'stopped', stopReason: action.reason }
    default:
      return state
  }
}
