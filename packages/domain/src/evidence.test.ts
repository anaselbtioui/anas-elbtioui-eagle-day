import { describe, expect, it } from 'vitest'
import {
  canArchivePack,
  createEmptyPack,
  DECLARE_GUIDANCE_WINDOW_MS,
  deriveNowStep,
  evidenceReducer,
  expireDraftPack,
  isDeclareGuidanceExpired,
  isNowDraftExpired,
  isPackArchived,
  nextNowStep,
  NOW_DRAFT_TTL_MS,
  photoSlotsForParts,
  shouldStopForInjury,
  shouldStopForOtherDriver,
} from './evidence'

describe('stop branch', () => {
  it('stops on injury yes or unknown', () => {
    expect(shouldStopForInjury('yes')).toBe(true)
    expect(shouldStopForInjury('unknown')).toBe(true)
    expect(shouldStopForInjury('no')).toBe(false)
  })

  it('stops on refuses fled unknown other driver', () => {
    expect(shouldStopForOtherDriver('refuses')).toBe(true)
    expect(shouldStopForOtherDriver('fled')).toBe(true)
    expect(shouldStopForOtherDriver('unknown')).toBe(true)
    expect(shouldStopForOtherDriver('cooperates')).toBe(false)
    expect(shouldStopForOtherDriver('alone')).toBe(false)
  })

  it('routes next step', () => {
    expect(nextNowStep({ injury: null, otherDriver: null })).toBe('injury')
    expect(nextNowStep({ injury: 'yes', otherDriver: null })).toBe('stop')
    expect(nextNowStep({ injury: 'no', otherDriver: null })).toBe('other')
    expect(nextNowStep({ injury: 'no', otherDriver: 'fled' })).toBe('stop')
    expect(nextNowStep({ injury: 'no', otherDriver: 'cooperates' })).toBe('constat')
  })
})

describe('NOW draft expiry', () => {
  it('expires draft after TTL from createdAt', () => {
    const pack = {
      ...createEmptyPack(),
      createdAt: '2026-09-21T10:00:00.000Z',
      status: 'draft' as const,
    }
    const before = Date.parse('2026-09-21T13:59:00.000Z')
    const after = Date.parse('2026-09-21T14:00:01.000Z')
    expect(NOW_DRAFT_TTL_MS).toBe(4 * 60 * 60 * 1000)
    expect(isNowDraftExpired(pack, before)).toBe(false)
    expect(isNowDraftExpired(pack, after)).toBe(true)
    expect(expireDraftPack(pack, after).status).toBe('expired')
    expect(expireDraftPack(pack, before).status).toBe('draft')
  })

  it('marks the 5-day guidance window without touching saved status', () => {
    const createdAt = '2026-09-01T10:00:00.000Z'
    const before = Date.parse('2026-09-06T10:00:00.000Z')
    const after = Date.parse('2026-09-06T10:00:01.000Z')
    expect(DECLARE_GUIDANCE_WINDOW_MS).toBe(5 * 24 * 60 * 60 * 1000)
    expect(isDeclareGuidanceExpired(createdAt, before)).toBe(false)
    expect(isDeclareGuidanceExpired(createdAt, after)).toBe(true)
    expect(isDeclareGuidanceExpired(undefined, after)).toBe(false)
  })

  it('does not expire saved or stopped', () => {
    const old = '2020-01-01T00:00:00.000Z'
    expect(isNowDraftExpired({ status: 'saved', createdAt: old })).toBe(false)
    expect(isNowDraftExpired({ status: 'stopped', createdAt: old })).toBe(false)
  })
})

describe('archive eligibility', () => {
  it('allows stopped and expired', () => {
    expect(
      canArchivePack({
        ...createEmptyPack(),
        status: 'stopped',
        archivedAt: null,
      }),
    ).toBe(true)
    expect(
      canArchivePack({
        ...createEmptyPack(),
        status: 'expired',
        archivedAt: null,
      }),
    ).toBe(true)
  })

  it('allows draft past TTL', () => {
    const pack = {
      ...createEmptyPack(),
      status: 'draft' as const,
      createdAt: '2020-01-01T00:00:00.000Z',
      archivedAt: null,
    }
    expect(canArchivePack(pack)).toBe(true)
  })

  it('blocks draft, saved, and already archived', () => {
    const fresh = createEmptyPack()
    expect(canArchivePack(fresh)).toBe(false)
    expect(canArchivePack({ ...fresh, status: 'saved' })).toBe(false)
    expect(
      canArchivePack({
        ...fresh,
        status: 'stopped',
        archivedAt: '2026-09-23T10:00:00.000Z',
      }),
    ).toBe(false)
    expect(isPackArchived({ archivedAt: '2026-09-23T10:00:00.000Z' })).toBe(true)
    expect(isPackArchived({ archivedAt: null })).toBe(false)
  })
})

describe('deriveNowStep', () => {
  it('starts at injury', () => {
    expect(deriveNowStep(createEmptyPack())).toBe('injury')
  })

  it('resumes after injury no at other', () => {
    let pack = createEmptyPack()
    pack = evidenceReducer(pack, { type: 'SET_INJURY', injury: 'no' })
    expect(deriveNowStep(pack)).toBe('other')
  })

  it('resumes at constat after other cooperates', () => {
    let pack = createEmptyPack()
    pack = evidenceReducer(pack, { type: 'SET_INJURY', injury: 'no' })
    pack = evidenceReducer(pack, { type: 'SET_OTHER', otherDriver: 'cooperates' })
    expect(deriveNowStep(pack)).toBe('constat')
  })

  it('resumes at photos after parts chosen', () => {
    let pack = createEmptyPack()
    pack = evidenceReducer(pack, { type: 'SET_INJURY', injury: 'no' })
    pack = evidenceReducer(pack, { type: 'SET_OTHER', otherDriver: 'alone' })
    pack = evidenceReducer(pack, { type: 'TOGGLE_PART', part: 'front' })
    expect(deriveNowStep(pack)).toBe('photos')
  })

  it('returns stop and saved', () => {
    let stopped = createEmptyPack()
    stopped = evidenceReducer(stopped, { type: 'SET_INJURY', injury: 'yes' })
    expect(deriveNowStep(stopped)).toBe('stop')
    let saved = createEmptyPack()
    saved = evidenceReducer(saved, { type: 'SET_INJURY', injury: 'no' })
    saved = evidenceReducer(saved, { type: 'SET_OTHER', otherDriver: 'alone' })
    saved = evidenceReducer(saved, { type: 'SAVE' })
    expect(deriveNowStep(saved)).toBe('saved')
  })
})

describe('evidence reducer', () => {
  it('marks stopped on injury', () => {
    const pack = createEmptyPack()
    const next = evidenceReducer(pack, { type: 'SET_INJURY', injury: 'yes' })
    expect(next.status).toBe('stopped')
    expect(next.stopReason).toBe('injury')
  })

  it('saves pack', () => {
    let pack = createEmptyPack()
    pack = evidenceReducer(pack, { type: 'SET_INJURY', injury: 'no' })
    pack = evidenceReducer(pack, { type: 'SET_OTHER', otherDriver: 'alone' })
    pack = evidenceReducer(pack, { type: 'TOGGLE_PART', part: 'front' })
    pack = evidenceReducer(pack, { type: 'SAVE' })
    expect(pack.status).toBe('saved')
    expect(pack.damagedParts).toEqual(['front'])
  })

  it('builds photo slots from parts', () => {
    const slots = photoSlotsForParts(['front', 'rear'])
    expect(slots[0]).toBe('scene')
    expect(slots).toContain('front')
    expect(slots).toContain('rear')
    expect(slots).toContain('cornerFrontLeft')
  })
})
