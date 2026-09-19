import { describe, expect, it } from 'vitest'
import {
  buildE164FromNationalDisplay,
  isValidMoroccanPhone,
  normalizePhoneToE164,
} from '@/lib/phone'

describe('phone (MA enforced)', () => {
  it('normalizes local MA mobile to E.164', () => {
    expect(normalizePhoneToE164('0612345678')).toEqual({ e164: '+212612345678' })
    expect(normalizePhoneToE164('612345678')).toEqual({ e164: '+212612345678' })
  })

  it('accepts +212 and 00212 forms', () => {
    expect(normalizePhoneToE164('+212612345678')).toEqual({ e164: '+212612345678' })
    expect(normalizePhoneToE164('00212612345678')).toEqual({ e164: '+212612345678' })
  })

  it('rejects foreign numbers', () => {
    expect(normalizePhoneToE164('+33612345678')).toEqual({ error: 'invalid' })
    expect(isValidMoroccanPhone('+33612345678')).toBe(false)
  })

  it('rejects incomplete / invalid MA', () => {
    expect(normalizePhoneToE164('0612')).toEqual({ error: 'invalid' })
    expect(isValidMoroccanPhone('+212612')).toBe(false)
  })

  it('builds E.164 from national display', () => {
    expect(buildE164FromNationalDisplay('06 12 34 56 78')).toBe('+212612345678')
  })
})
