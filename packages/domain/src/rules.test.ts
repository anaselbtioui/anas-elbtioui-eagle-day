import { describe, expect, it } from 'vitest'
import {
  applyEvidenceRules,
  canSubmit,
  collectMissingPieces,
  motoristCloseFromPack,
  mustStop,
  offerAssistance,
} from './rules.ts'
import { emptyEvidence } from './rules.ts'
import type { EvidencePack } from './types.ts'

function pack(partial: Partial<EvidencePack> & Pick<EvidencePack, 'incident'>): EvidencePack {
  return {
    otherParty: null,
    evidence: emptyEvidence(partial.incident.id),
    ...partial,
  }
}

describe('mustStop', () => {
  it('stops on injury yes or unknown', () => {
    expect(mustStop('yes', 'known')).toBe(true)
    expect(mustStop('unknown', 'known')).toBe(true)
    expect(mustStop('no', 'known')).toBe(false)
  })

  it('stops when other party cannot sign constat', () => {
    expect(mustStop('no', 'unknown')).toBe(true)
    expect(mustStop('no', 'refused')).toBe(true)
    expect(mustStop('no', 'fled')).toBe(true)
  })
})

describe('applyEvidenceRules', () => {
  it('requires PV on injury', () => {
    const next = applyEvidenceRules(
      pack({
        incident: {
          id: 'INC-2',
          ref: 'ACC-INC20000',
          motoristId: 'M-2',
          policyId: null,
          occurredAt: null,
          city: 'Marrakech',
          injury: 'yes',
          vehicleImmobilised: false,
          otherPartyId: null,
          workCommute: null,
          archivedAt: null,
        },
      }),
    )
    expect(next.evidence.pv).toBe('required')
    expect(canSubmit(next.evidence)).toBe(false)
  })

  it('blocks déclaration without constat or PV', () => {
    const p = applyEvidenceRules(
      pack({
        incident: {
          id: 'INC-1',
          ref: 'ACC-INC10000',
          motoristId: 'M-1',
          policyId: 'P-1',
          occurredAt: null,
          city: 'Casablanca',
          injury: 'no',
          vehicleImmobilised: false,
          otherPartyId: 'O-1',
          workCommute: false,
          archivedAt: null,
        },
        otherParty: { id: 'O-1', status: 'known', name: 'X', plate: null },
        evidence: { ...emptyEvidence('INC-1'), constat: 'absent', pv: 'not_needed' },
      }),
    )
    expect(collectMissingPieces(p, 'MA-AUTO-24018')).toContain('constat_or_pv')
    expect(canSubmit(p.evidence)).toBe(false)
  })

  it('allows submit when constat complete', () => {
    const evidence = { ...emptyEvidence('INC-1'), constat: 'complete' as const, pv: 'not_needed' as const }
    expect(canSubmit(evidence)).toBe(true)
  })

  it('keeps pv required after manual cancel even when other party is known', () => {
    const next = applyEvidenceRules(
      pack({
        incident: {
          id: 'INC-3',
          ref: 'ACC-INC30000',
          motoristId: 'M-3',
          policyId: 'P-1',
          occurredAt: null,
          city: 'Rabat',
          injury: 'no',
          vehicleImmobilised: false,
          otherPartyId: 'O-3',
          workCommute: null,
          archivedAt: null,
        },
        otherParty: { id: 'O-3', status: 'known', name: 'Y', plate: null },
        evidence: { ...emptyEvidence('INC-3'), pv: 'required' },
      }),
    )
    expect(next.evidence.pv).toBe('required')
  })
})

describe('offerAssistance', () => {
  it('hides only when contract says no', () => {
    expect(offerAssistance('no')).toBe(false)
    expect(offerAssistance('yes')).toBe(true)
    expect(offerAssistance('unknown')).toBe(true)
  })
})

describe('motoristCloseFromPack', () => {
  const now = '2026-09-24T12:00:00.000Z'

  it('marks cancelled when pv is required (stop / cancel)', () => {
    const close = motoristCloseFromPack(
      pack({
        incident: {
          id: 'INC-c',
          ref: 'ACC-INCC0000',
          motoristId: 'M-1',
          policyId: 'P-1',
          occurredAt: null,
          city: 'Rabat',
          injury: 'no',
          vehicleImmobilised: false,
          otherPartyId: null,
          workCommute: null,
          archivedAt: '2026-09-24T10:00:00.000Z',
        },
        evidence: { ...emptyEvidence('INC-c'), pv: 'required' },
      }),
      now,
    )
    expect(close).toEqual({ closedAt: now, closedReason: 'cancelled' })
  })

  it('marks archived when archivedAt set and not cancelled', () => {
    const close = motoristCloseFromPack(
      pack({
        incident: {
          id: 'INC-a',
          ref: 'ACC-INCA0000',
          motoristId: 'M-1',
          policyId: 'P-1',
          occurredAt: null,
          city: 'Rabat',
          injury: 'no',
          vehicleImmobilised: false,
          otherPartyId: null,
          workCommute: null,
          archivedAt: '2026-09-24T10:00:00.000Z',
        },
        evidence: { ...emptyEvidence('INC-a'), pv: 'not_needed' },
      }),
      now,
    )
    expect(close).toEqual({
      closedAt: '2026-09-24T10:00:00.000Z',
      closedReason: 'archived',
    })
  })

  it('clears close when unarchived and not cancelled', () => {
    const close = motoristCloseFromPack(
      pack({
        incident: {
          id: 'INC-o',
          ref: 'ACC-INCO0000',
          motoristId: 'M-1',
          policyId: 'P-1',
          occurredAt: null,
          city: 'Rabat',
          injury: 'no',
          vehicleImmobilised: false,
          otherPartyId: null,
          workCommute: null,
          archivedAt: null,
        },
        evidence: { ...emptyEvidence('INC-o'), pv: 'not_needed' },
      }),
      now,
    )
    expect(close).toEqual({ closedAt: null, closedReason: null })
  })
})
