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

export type EvidencePackStatus = 'draft' | 'saved' | 'stopped'

export interface EvidencePack {
  id: string
  status: EvidencePackStatus
  createdAt: string
  updatedAt: string
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
}

export function createEmptyPack(): EvidencePack {
  const now = new Date().toISOString()
  return {
    id: `PACK-${Date.now()}`,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
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
