import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumber,
  type CountryCode,
} from 'libphonenumber-js'

export type { CountryCode }

/** Morocco only — Med Assurance is MA-scoped. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = 'MA'
export const MOROCCO_DIAL_CODE = `+${getCountryCallingCode('MA')}`

export function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

export function formatNationalDigits(digits: string, country: CountryCode = DEFAULT_PHONE_COUNTRY): string {
  if (!digits) return ''
  const at = new AsYouType(country)
  for (const d of digits) {
    at.input(d)
  }
  return at.getChars()
}

export function buildE164FromNationalDisplay(
  nationalDisplay: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY,
): string {
  const digits = digitsOnly(nationalDisplay)
  if (!digits) return ''
  const at = new AsYouType(country)
  for (const d of digits) {
    at.input(d)
  }
  const num = at.getNumber()
  if (num?.isValid() && num.country === country) return num.number
  try {
    const p = parsePhoneNumber(nationalDisplay, country)
    if (p?.isValid() && p.country === country) return p.number
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * Handle paste/type of +… / 00… . Only accepts Morocco; other countries → null e164 + flagged.
 */
export function applyInternationalTypedInput(
  raw: string,
  fallbackCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): {
  country: CountryCode
  nationalDisplay: string
  e164: string
  foreignCountry: boolean
} | null {
  const t = raw.trim()
  if (!t.startsWith('+') && !t.startsWith('00')) return null

  const normalized = t.startsWith('00')
    ? `+${digitsOnly(t.slice(2))}`
    : `+${digitsOnly(t.startsWith('+') ? t.slice(1) : t)}`

  if (normalized.length < 2) {
    return {
      country: fallbackCountry,
      nationalDisplay: raw,
      e164: '',
      foreignCountry: false,
    }
  }

  const at = new AsYouType()
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i]
    if (c === '+') at.input('+')
    else if (/\d/.test(c)) at.input(c)
  }

  const detected = at.getCountry() as CountryCode | undefined
  const fullDigits = digitsOnly(normalized)
  const numFromIntl = at.getNumber()

  if (detected && detected !== fallbackCountry) {
    return {
      country: fallbackCountry,
      nationalDisplay: '',
      e164: '',
      foreignCountry: true,
    }
  }

  if (detected) {
    const cc = getCountryCallingCode(detected)
    let nationalDigits =
      numFromIntl?.nationalNumber != null ? String(numFromIntl.nationalNumber) : ''
    if (!nationalDigits) {
      nationalDigits = fullDigits.startsWith(cc) ? fullDigits.slice(cc.length) : fullDigits
    }
    const nationalDisplay = formatNationalDigits(nationalDigits, detected)
    const e164 =
      numFromIntl?.isValid() === true && numFromIntl.country === fallbackCountry
        ? numFromIntl.number
        : buildE164FromNationalDisplay(nationalDisplay, detected)
    return {
      country: detected,
      nationalDisplay,
      e164,
      foreignCountry: false,
    }
  }

  return {
    country: fallbackCountry,
    nationalDisplay: at.getChars() || raw,
    e164: '',
    foreignCountry: false,
  }
}

export type NormalizePhoneResult =
  | { e164: string }
  | { error: 'empty' }
  | { error: 'invalid' }

export function normalizePhoneToE164(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): NormalizePhoneResult {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if (!t) return { error: 'empty' }

  try {
    const intl = applyInternationalTypedInput(t, defaultCountry)
    if (intl?.foreignCountry) return { error: 'invalid' }
    if (intl?.e164) return { e164: intl.e164 }

    const p = t.startsWith('+') ? parsePhoneNumber(t) : parsePhoneNumber(t, defaultCountry)
    if (p?.isValid() && p.country === defaultCountry) return { e164: p.number }
  } catch {
    /* fall through */
  }

  const e164 = buildE164FromNationalDisplay(t, defaultCountry)
  if (e164) return { e164 }

  return { error: 'invalid' }
}

export function isValidE164Phone(value: string | null | undefined): boolean {
  const t = typeof value === 'string' ? value.trim() : ''
  if (!t) return false
  try {
    const p = parsePhoneNumber(t)
    return p.isValid()
  } catch {
    return false
  }
}

/** Strict: valid E.164 and Morocco only. */
export function isValidMoroccanPhone(value: string | null | undefined): boolean {
  const t = typeof value === 'string' ? value.trim() : ''
  if (!t) return false
  try {
    const p = parsePhoneNumber(t)
    return p.isValid() && p.country === 'MA'
  } catch {
    return false
  }
}

export function parseE164ToNationalParts(
  e164: string,
  fallbackCountry: CountryCode = DEFAULT_PHONE_COUNTRY,
): { country: CountryCode; nationalDisplay: string } {
  try {
    const p = parsePhoneNumber(e164)
    if (p?.country) {
      return {
        country: p.country === 'MA' ? p.country : fallbackCountry,
        nationalDisplay:
          p.country === 'MA'
            ? formatNationalDigits(p.nationalNumber ?? '', p.country)
            : '',
      }
    }
  } catch {
    /* ignore */
  }
  return {
    country: fallbackCountry,
    nationalDisplay: formatNationalDigits(digitsOnly(e164), fallbackCountry),
  }
}

export function countryCodeToFlagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}
