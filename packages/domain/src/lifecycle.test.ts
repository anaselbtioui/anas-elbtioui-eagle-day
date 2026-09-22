import { describe, expect, it } from 'vitest'
import {
  dossierDominantTone,
  dossierLifecycleSegments,
  dossierLifecycleStages,
  packLifecycleSegments,
  packLifecycleStages,
} from './lifecycle.ts'

describe('dossierLifecycleSegments', () => {
  it('flags blocked as red collect', () => {
    const segs = dossierLifecycleSegments('blocked_missing_evidence')
    expect(segs.map((s) => s.tone)).toEqual(['red', 'gray', 'gray', 'gray'])
    expect(dossierDominantTone('blocked_missing_evidence')).toBe('red')
  })

  it('lights desk amber when waiting motorist', () => {
    expect(dossierLifecycleSegments('waiting_motorist').map((s) => s.tone)).toEqual([
      'green',
      'green',
      'amber',
      'gray',
    ])
  })

  it('marks insurer blue when handed off', () => {
    expect(dossierLifecycleSegments('with_insurer').map((s) => s.tone)).toEqual([
      'green',
      'green',
      'green',
      'blue',
    ])
    expect(dossierDominantTone('with_insurer')).toBe('blue')
  })

  it('marks declare as next when still collecting', () => {
    const stages = dossierLifecycleStages('draft')
    expect(stages.find((s) => s.id === 'declare')?.state).toBe('pending')
    expect(stages.find((s) => s.id === 'collect')?.state).toBe('active')
  })
})

describe('packLifecycleSegments', () => {
  it('marks saved collect+ready green', () => {
    expect(packLifecycleSegments('saved').map((s) => s.tone)).toEqual(['green', 'green', 'gray'])
  })

  it('marks ready as current when saved', () => {
    expect(packLifecycleStages('saved').find((s) => s.id === 'ready')?.state).toBe('active')
  })
})
