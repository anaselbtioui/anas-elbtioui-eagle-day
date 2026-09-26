export type ReleaseAudience = 'motorist' | 'broker' | 'both'

export type ReleaseNote = {
  /** Stable id — bump for each significant ship. */
  id: string
  /** ISO date YYYY-MM-DD */
  date: string
  audiences: ReleaseAudience[]
  titleKey: string
  bodyKeys: string[]
}

/**
 * Newest first. Add a row when a meaningful product change lands.
 * Copy lives under `releases.*` in i18n.
 */
export const RELEASES: ReleaseNote[] = [
  {
    id: '2026-09-26-broker-desk',
    date: '2026-09-26',
    audiences: ['broker'],
    titleKey: 'releases.20260926Broker.title',
    bodyKeys: [
      'releases.20260926Broker.b1',
      'releases.20260926Broker.b2',
      'releases.20260926Broker.b3',
    ],
  },
  {
    id: '2026-09-26-motorist-shell',
    date: '2026-09-26',
    audiences: ['motorist'],
    titleKey: 'releases.20260926Motorist.title',
    bodyKeys: [
      'releases.20260926Motorist.b1',
      'releases.20260926Motorist.b2',
      'releases.20260926Motorist.b3',
    ],
  },
]

export function releasesForAudience(audience: 'motorist' | 'broker'): ReleaseNote[] {
  return RELEASES.filter(
    (r) => r.audiences.includes('both') || r.audiences.includes(audience),
  )
}
