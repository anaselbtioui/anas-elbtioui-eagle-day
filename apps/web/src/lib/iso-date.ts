/** Local calendar date helpers (ISO `YYYY-MM-DD`, no UTC shift). */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseIsoDate(iso: string): Date | null {
  const m = ISO_RE.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** French display `jj/mm/aaaa`. */
export function formatDisplayFr(iso: string): string {
  const dt = parseIsoDate(iso)
  if (!dt) return ''
  const d = String(dt.getDate()).padStart(2, '0')
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${dt.getFullYear()}`
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

/** Monday-first month grid (6×7). Includes adjacent-month days. */
export function monthGrid(view: Date): Date[] {
  const first = startOfMonth(view)
  // JS: Sun=0 … Sat=6 → Mon-first offset
  const mondayOffset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }
  return cells
}
