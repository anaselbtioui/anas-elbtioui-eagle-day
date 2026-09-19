import { describe, expect, it } from 'vitest'
import { createEmptyPack } from '@/domain/evidence'
import { packLooksStarted, toDomainPack } from '@/services/pack-map.ts'

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
})
