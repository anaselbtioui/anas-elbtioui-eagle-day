import { releasesForAudience, type ReleaseNote } from './catalog.ts'

function storageKey(audience: 'motorist' | 'broker'): string {
  return `labas.release.seen.${audience}`
}

export function getSeenReleaseId(audience: 'motorist' | 'broker'): string | null {
  try {
    const v = localStorage.getItem(storageKey(audience))
    return v?.trim() || null
  } catch {
    return null
  }
}

export function markReleaseSeen(audience: 'motorist' | 'broker', id: string): void {
  try {
    localStorage.setItem(storageKey(audience), id)
  } catch {
    /* private mode / quota — ignore */
  }
}

/** Newest matching note the user has not dismissed yet. */
export function latestUnseenRelease(
  audience: 'motorist' | 'broker',
): ReleaseNote | null {
  const list = releasesForAudience(audience)
  if (list.length === 0) return null
  const seen = getSeenReleaseId(audience)
  if (!seen) return list[0]!
  const seenIdx = list.findIndex((r) => r.id === seen)
  if (seenIdx === 0) return null
  return list[0]!
}
