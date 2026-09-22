import { describe, expect, it } from 'vitest'
import { fullTimestampFr, shortRelativeFr } from '@/lib/relative-time'

describe('shortRelativeFr', () => {
  const now = Date.parse('2026-09-21T16:00:00.000Z')

  it('formats compact french units', () => {
    expect(shortRelativeFr('2026-09-21T15:59:30.000Z', now)).toBe('<1m')
    expect(shortRelativeFr('2026-09-21T15:45:00.000Z', now)).toBe('15m')
    expect(shortRelativeFr('2026-09-21T13:00:00.000Z', now)).toBe('3h')
    expect(shortRelativeFr('2026-09-19T16:00:00.000Z', now)).toBe('2j')
    expect(shortRelativeFr('2026-09-07T16:00:00.000Z', now)).toBe('2sem')
  })
})

describe('fullTimestampFr', () => {
  it('returns locale long datetime', () => {
    const s = fullTimestampFr('2026-09-21T14:30:00.000Z')
    expect(s.length).toBeGreaterThan(8)
    expect(s).toMatch(/2026/)
  })
})
