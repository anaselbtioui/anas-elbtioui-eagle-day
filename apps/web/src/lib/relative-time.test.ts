import { describe, expect, it } from 'vitest'
import { fullTimestamp, relativeTime, shortRelative } from '@/lib/relative-time'

describe('shortRelative', () => {
  const now = Date.parse('2026-09-21T16:00:00.000Z')

  it('formats compact french units', () => {
    expect(shortRelative('2026-09-21T15:59:30.000Z', 'fr', now)).toBe('<1m')
    expect(shortRelative('2026-09-21T15:45:00.000Z', 'fr', now)).toBe('15m')
    expect(shortRelative('2026-09-21T13:00:00.000Z', 'fr', now)).toBe('3h')
    expect(shortRelative('2026-09-19T16:00:00.000Z', 'fr', now)).toBe('2j')
    expect(shortRelative('2026-09-07T16:00:00.000Z', 'fr', now)).toBe('2sem')
  })

  it('formats compact english units', () => {
    expect(shortRelative('2026-09-19T16:00:00.000Z', 'en', now)).toBe('2d')
    expect(shortRelative('2026-09-07T16:00:00.000Z', 'en', now)).toBe('2w')
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-09-21T16:00:00.000Z')

  it('formats spoken french relative age', () => {
    expect(relativeTime('2026-09-21T15:59:30.000Z', 'fr', now)).toBe('à l’instant')
    expect(relativeTime('2026-09-21T15:45:00.000Z', 'fr', now)).toMatch(/15/)
    expect(relativeTime('2026-09-21T15:00:00.000Z', 'fr', now)).toMatch(/1/)
    expect(relativeTime('2026-09-21T13:00:00.000Z', 'fr', now)).toMatch(/3/)
  })

  it('formats spoken english relative age', () => {
    expect(relativeTime('2026-09-21T15:59:30.000Z', 'en', now)).toBe('just now')
    expect(relativeTime('2026-09-21T15:45:00.000Z', 'en', now)).toMatch(/15/)
  })
})

describe('fullTimestamp', () => {
  it('returns locale long datetime', () => {
    const s = fullTimestamp('2026-09-21T14:30:00.000Z', 'fr')
    expect(s.length).toBeGreaterThan(8)
    expect(s).toMatch(/2026/)
  })
})
