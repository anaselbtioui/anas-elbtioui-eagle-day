import { describe, expect, it } from 'vitest'
import { createEmptyPack, evidenceReducer } from '@/domain/evidence'
import { fromDomainPack, packLooksStarted, toDomainPack } from '@/services/pack-map.ts'

describe('pack-map', () => {
  it('maps cooperating other driver and complete constat', () => {
    const ui = createEmptyPack()
    ui.id = 'INC-x'
    ui.injury = 'no'
    ui.otherDriver = 'cooperates'
    ui.constat = {
      otherName: 'Karim',
      otherPlate: '1-A-1',
      otherPhone: '',
      otherInsurer: '',
      notes: 'Choc arrière',
      attestedDocsChecked: true,
    }
    ui.photos = { scene: 'data:image/png;base64,xx' }
    const pack = toDomainPack(ui, { motoristId: 'M-1', policyId: 'P-1', city: 'Rabat' })
    expect(pack.otherParty?.status).toBe('known')
    expect(pack.evidence.constat).toBe('complete')
    expect(pack.evidence.photos[0]?.slot).toBe('scene')
    expect(packLooksStarted(pack)).toBe(true)
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
