import { describe, expect, it } from 'vitest'
import { createEmptyPack, evidenceReducer } from '@/domain/evidence'
import { fromDomainPack, toDomainPack } from '@/services/pack-map.ts'

describe('archive round-trip', () => {
  it('persists archivedAt on the domain incident', () => {
    let ui = createEmptyPack()
    ui.id = 'INC-arch'
    ui.injury = 'no'
    ui.status = 'stopped'
    ui.stopReason = 'other'
    ui.archivedAt = '2026-09-23T15:00:00.000Z'
    const domain = toDomainPack(ui, { motoristId: 'M-1', policyId: null, city: 'Fès' })
    expect(domain.incident.archivedAt).toBe('2026-09-23T15:00:00.000Z')
    const back = fromDomainPack(domain)
    expect(back.archivedAt).toBe('2026-09-23T15:00:00.000Z')
    expect(back.status).toBe('stopped')
  })

  it('clears archive on unarchive mapping', () => {
    const ui = {
      ...createEmptyPack(),
      id: 'INC-arch-2',
      injury: 'no' as const,
      status: 'expired' as const,
      archivedAt: null,
    }
    const domain = toDomainPack(ui, { motoristId: 'M-1', policyId: null, city: null })
    expect(domain.incident.archivedAt).toBeNull()
  })

  it('round-trips user cancel (stopped) without injury answer', () => {
    let ui = createEmptyPack()
    ui.id = 'INC-cancel'
    ui = evidenceReducer(ui, { type: 'STOP', reason: 'other' })
    expect(ui.status).toBe('stopped')
    const domain = toDomainPack(ui, { motoristId: 'M-1', policyId: null, city: 'Fès' })
    expect(domain.evidence.pv).toBe('required')
    expect(domain.incident.injury).toBe('no')
    const back = fromDomainPack(domain)
    expect(back.status).toBe('stopped')
    expect(back.stopReason).toBe('other')
  })
})
