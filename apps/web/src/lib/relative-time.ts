/** Compact / spoken relative age, locale-aware. */

const MIN_MS = 60_000
const HOUR_MS = 60 * MIN_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

type ShortUnit = { limit: number; div: number; fr: string; en: string }

const SHORT_UNITS: ShortUnit[] = [
  { limit: HOUR_MS, div: MIN_MS, fr: 'm', en: 'm' },
  { limit: DAY_MS, div: HOUR_MS, fr: 'h', en: 'h' },
  { limit: WEEK_MS, div: DAY_MS, fr: 'j', en: 'd' },
  { limit: MONTH_MS, div: WEEK_MS, fr: 'sem', en: 'w' },
  { limit: YEAR_MS, div: MONTH_MS, fr: 'mo', en: 'mo' },
]

function langBase(lng: string): 'fr' | 'en' {
  return lng.toLowerCase().startsWith('en') ? 'en' : 'fr'
}

function intlLocale(lng: string): string {
  return langBase(lng) === 'en' ? 'en-GB' : 'fr-MA'
}

export function shortRelative(iso: string, lng = 'fr', now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, now - t)
  if (diff < MIN_MS) return '<1m'
  const base = langBase(lng)
  for (const u of SHORT_UNITS) {
    if (diff < u.limit) return `${Math.floor(diff / u.div)}${base === 'en' ? u.en : u.fr}`
  }
  return `${Math.floor(diff / YEAR_MS)}${base === 'en' ? 'y' : 'a'}`
}

type RtfUnit = Intl.RelativeTimeFormatUnit

function pickUnit(diff: number): { value: number; unit: RtfUnit } {
  if (diff < HOUR_MS) return { value: Math.floor(diff / MIN_MS), unit: 'minute' }
  if (diff < DAY_MS) return { value: Math.floor(diff / HOUR_MS), unit: 'hour' }
  if (diff < WEEK_MS) return { value: Math.floor(diff / DAY_MS), unit: 'day' }
  if (diff < MONTH_MS) return { value: Math.floor(diff / WEEK_MS), unit: 'week' }
  if (diff < YEAR_MS) return { value: Math.floor(diff / MONTH_MS), unit: 'month' }
  return { value: Math.floor(diff / YEAR_MS), unit: 'year' }
}

/** Spoken relative age: `il y a 1 heure` / `1 hour ago`. */
export function relativeTime(iso: string, lng = 'fr', now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, now - t)
  if (diff < MIN_MS) return langBase(lng) === 'en' ? 'just now' : 'à l’instant'
  const { value, unit } = pickUnit(diff)
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lng), { numeric: 'always' })
  return rtf.format(-value, unit)
}

/** Full local timestamp for tooltip. */
export function fullTimestamp(iso: string, lng = 'fr'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(intlLocale(lng), {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d)
}

/** @deprecated Prefer `shortRelative`. */
export const shortRelativeFr = (iso: string, now = Date.now()) => shortRelative(iso, 'fr', now)
/** @deprecated Prefer `relativeTime`. */
export const relativeFr = (iso: string, now = Date.now()) => relativeTime(iso, 'fr', now)
/** @deprecated Prefer `fullTimestamp`. */
export const fullTimestampFr = (iso: string) => fullTimestamp(iso, 'fr')
