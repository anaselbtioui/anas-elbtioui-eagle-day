import { describe, expect, it } from 'vitest'
import { CONSTAT_MA_CIRCONSTANCES, CONSTAT_MA_FIELDS } from './constat-ma.ts'

describe('constat-ma field map', () => {
  it('lists the standard 17 circonstances', () => {
    expect(CONSTAT_MA_CIRCONSTANCES).toHaveLength(17)
    expect(CONSTAT_MA_CIRCONSTANCES[0]).toMatch(/stationnement/i)
    expect(CONSTAT_MA_CIRCONSTANCES[16]).toMatch(/feu rouge|priorité/i)
  })

  it('covers A/B vehicle slots and common header fields', () => {
    const sections = new Set(CONSTAT_MA_FIELDS.map((f) => f.section))
    expect(sections.has('common')).toBe(true)
    expect(sections.has('vehicle_a')).toBe(true)
    expect(sections.has('vehicle_b')).toBe(true)
    expect(sections.has('circonstances')).toBe(true)
    expect(sections.has('croquis')).toBe(true)
    expect(sections.has('signatures')).toBe(true)
  })
})
