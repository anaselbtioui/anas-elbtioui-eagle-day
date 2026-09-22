import { describe, expect, it } from 'vitest'
import {
  applyEvidenceRules,
  canSubmit,
  collectMissingPieces,
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
})

describe('offerAssistance', () => {
  it('hides only when contract says no', () => {
    expect(offerAssistance('no')).toBe(false)
    expect(offerAssistance('yes')).toBe(true)
    expect(offerAssistance('unknown')).toBe(true)
  })
})
