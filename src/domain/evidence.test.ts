import { describe, expect, it } from 'vitest'
import {
  createEmptyPack,
  evidenceReducer,
  nextNowStep,
  photoSlotsForParts,
  shouldStopForInjury,
  shouldStopForOtherDriver,
} from '@/domain/evidence'

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
