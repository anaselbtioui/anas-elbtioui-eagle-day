/** Moroccan person / CIN / plate field rules (shared UI + domain). */

const PERSON_NAME_RE = /^[\p{L}]+(?:[ '\-][\p{L}]+)*$/u

/** Letters (incl. accents), spaces, hyphen, apostrophe — no digits. */
export function isPersonName(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  return PERSON_NAME_RE.test(t)
}

export function normalizePersonName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** 1–2 Latin letters then digits only (e.g. CD676343). */
const CIN_RE = /^[A-Za-z]{1,2}\d+$/

export function normalizeCin(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function isMoroccanCin(value: string): boolean {
  const t = normalizeCin(value)
  if (!t) return false
  return CIN_RE.test(t)
}

/**
 * Classic Moroccan plate: digits-letter-digits (e.g. 12345-A-50).
 * Accepts optional spaces around hyphens.
 */
const PLATE_RE = /^\d{1,6}\s*-\s*[A-Za-z]\s*-\s*\d{1,2}$/

export function normalizePlate(value: string): string {
  const t = value.trim().toUpperCase().replace(/\s+/g, '')
  const m = t.match(/^(\d{1,6})-([A-Z])-(\d{1,2})$/)
  if (!m) return t
  return `${m[1]}-${m[2]}-${m[3]}`
}

export function isMoroccanPlate(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  return PLATE_RE.test(t)
}
