import { describe, expect, it, beforeEach } from 'vitest'
import { latestUnseenRelease, markReleaseSeen, getSeenReleaseId } from './seen.ts'

describe('release seen', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns newest when nothing seen', () => {
    expect(latestUnseenRelease('broker')?.id).toBe('2026-09-26-broker-desk')
    expect(latestUnseenRelease('motorist')?.id).toBe('2026-09-26-motorist-shell')
  })

  it('returns null after marking newest seen', () => {
    markReleaseSeen('broker', '2026-09-26-broker-desk')
    expect(getSeenReleaseId('broker')).toBe('2026-09-26-broker-desk')
    expect(latestUnseenRelease('broker')).toBeNull()
    expect(latestUnseenRelease('motorist')?.id).toBe('2026-09-26-motorist-shell')
  })
})
