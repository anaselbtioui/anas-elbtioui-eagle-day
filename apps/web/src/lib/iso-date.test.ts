import { describe, expect, it } from 'vitest'
import {
  formatDisplayFr,
  formatIsoDate,
  monthGrid,
  parseIsoDate,
  sameDay,
} from './iso-date.ts'

describe('iso-date', () => {
  it('round-trips local ISO', () => {
    const d = parseIsoDate('2026-09-23')
    expect(d).not.toBeNull()
    expect(formatIsoDate(d!)).toBe('2026-09-23')
    expect(formatDisplayFr('2026-09-23')).toBe('23/09/2026')
  })

  it('rejects invalid ISO', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull()
    expect(parseIsoDate('23/09/2026')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
  })

  it('builds Monday-first September 2026 grid', () => {
    const cells = monthGrid(new Date(2026, 8, 1))
    expect(cells).toHaveLength(42)
    // 1 Sep 2026 is Tuesday → Monday cell is 31 Aug
    expect(formatIsoDate(cells[0]!)).toBe('2026-08-31')
    expect(formatIsoDate(cells[1]!)).toBe('2026-09-01')
  })

  it('sameDay ignores time', () => {
    expect(sameDay(new Date(2026, 8, 23, 1), new Date(2026, 8, 23, 23))).toBe(true)
    expect(sameDay(new Date(2026, 8, 23), new Date(2026, 8, 24))).toBe(false)
  })
})
