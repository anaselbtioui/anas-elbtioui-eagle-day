/** Stored value: `ACC-D791D49E` (no hash). Display: `#ACC-D791D49E`. */

export function accidentRefFromId(id: string): string {
  const hex = id.replace(/[^a-fA-F0-9]/g, '').slice(0, 8).toUpperCase()
  const padded = `${hex}00000000`.slice(0, 8)
  return `ACC-${padded}`
}

export function newAccidentRef(seedId?: string): string {
  const seed = seedId ?? crypto.randomUUID()
  return accidentRefFromId(seed)
}

/** UI label with leading `#`. Falls back to id-derived ref. */
export function displayAccidentRef(ref: string | null | undefined, fallbackId?: string): string {
  const raw = (ref?.trim() || (fallbackId ? accidentRefFromId(fallbackId) : '')).replace(/^#/, '')
  return raw ? `#${raw}` : '—'
}

export function ensureAccidentRef(
  ref: string | null | undefined,
  id: string,
  taken?: Set<string>,
): string {
  let next = (ref?.trim() || accidentRefFromId(id)).replace(/^#/, '')
  if (!taken) return next
  if (!taken.has(next)) {
    taken.add(next)
    return next
  }
  let n = 2
  while (taken.has(`${next}-${n}`)) n += 1
  const unique = `${next}-${n}`
  taken.add(unique)
  return unique
}
