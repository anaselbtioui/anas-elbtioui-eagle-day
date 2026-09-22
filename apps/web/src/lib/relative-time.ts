/** Compact French relative age: `1m` `1h` `1j` `1sem` `1mo` `1a`. */

const MIN_MS = 60_000
const HOUR_MS = 60 * MIN_MS
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS

export function shortRelativeFr(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, now - t)
  if (diff < MIN_MS) return '<1m'
  if (diff < HOUR_MS) return `${Math.floor(diff / MIN_MS)}m`
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h`
  if (diff < WEEK_MS) return `${Math.floor(diff / DAY_MS)}j`
  if (diff < MONTH_MS) return `${Math.floor(diff / WEEK_MS)}sem`
  if (diff < YEAR_MS) return `${Math.floor(diff / MONTH_MS)}mo`
  return `${Math.floor(diff / YEAR_MS)}a`
}

function pluralFr(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** Spoken French relative age: `il y a 1 heure`, `il y a 2 jours`. */
export function relativeFr(iso: string, now = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, now - t)
  if (diff < MIN_MS) return 'à l’instant'
  if (diff < HOUR_MS) {
    const n = Math.floor(diff / MIN_MS)
    return `il y a ${n} ${pluralFr(n, 'minute', 'minutes')}`
  }
  if (diff < DAY_MS) {
    const n = Math.floor(diff / HOUR_MS)
    return `il y a ${n} ${pluralFr(n, 'heure', 'heures')}`
  }
  if (diff < WEEK_MS) {
    const n = Math.floor(diff / DAY_MS)
    return `il y a ${n} ${pluralFr(n, 'jour', 'jours')}`
  }
  if (diff < MONTH_MS) {
    const n = Math.floor(diff / WEEK_MS)
    return `il y a ${n} ${pluralFr(n, 'semaine', 'semaines')}`
  }
  if (diff < YEAR_MS) {
    const n = Math.floor(diff / MONTH_MS)
    return `il y a ${n} mois`
  }
  const n = Math.floor(diff / YEAR_MS)
  return `il y a ${n} ${pluralFr(n, 'an', 'ans')}`
}

/** Full local timestamp for tooltip (fr-FR). */
export function fullTimestampFr(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(d)
}
