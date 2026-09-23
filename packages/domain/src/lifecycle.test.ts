import { describe, expect, it } from 'vitest'
import {
  dossierDominantTone,
  dossierLifecycleSegments,
  dossierLifecycleStages,
  packDeclareBlocked,
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

  it('shows a closed déclaration window even when the portefeuille still blocked it', () => {
    const createdAt = '2026-09-01T10:00:00.000Z'
    const now = Date.parse('2026-09-07T10:00:01.000Z')
    const stages = packLifecycleStages('saved', { walletReady: false, createdAt, now })
    const ready = stages.find((s) => s.id === 'ready')
    const closed = stages.find((s) => s.id === 'closed')
    expect(ready?.state).toBe('cancelled')
    expect(ready?.block).toEqual({ id: 'wallet', titleKey: 'lifecycle.block.wallet' })
    expect(closed?.state).toBe('active')
    expect(closed?.tone).toBe('red')
    expect(closed?.block).toEqual({
      id: 'declareWindow',
      titleKey: 'lifecycle.block.declareWindowWallet',
    })
  })

  it('shows the guidance window alone when the portefeuille was ready', () => {
    const createdAt = '2026-09-01T10:00:00.000Z'
    const now = Date.parse('2026-09-07T10:00:01.000Z')
    const closed = packLifecycleStages('saved', { walletReady: true, createdAt, now }).find(
      (s) => s.id === 'closed',
    )
    expect(closed?.block?.titleKey).toBe('lifecycle.block.declareWindow')
  })

  it('holds prêt à déclarer on the wallet block', () => {
    const ready = packLifecycleStages('saved', { walletReady: false }).find((s) => s.id === 'ready')
    expect(ready?.tone).toBe('amber')
    expect(ready?.block).toEqual({ id: 'wallet', titleKey: 'lifecycle.block.wallet' })
    expect(packDeclareBlocked('saved', false)).toBe(true)
    expect(packDeclareBlocked('saved', true)).toBe(false)
    expect(packDeclareBlocked('draft', false)).toBe(false)
  })
})
