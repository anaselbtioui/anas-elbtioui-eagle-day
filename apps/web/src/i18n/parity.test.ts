import { describe, expect, it } from 'vitest'
import en from './en/common.json'
import fr from './fr/common.json'

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  if (typeof obj === 'string') return { [prefix]: obj }
  if (!obj || typeof obj !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    Object.assign(out, flatten(v, path))
  }
  return out
}

function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort()
}

describe('i18n fr/en parity', () => {
  const frFlat = flatten(fr)
  const enFlat = flatten(en)

  it('has the same key set', () => {
    expect(Object.keys(enFlat).sort()).toEqual(Object.keys(frFlat).sort())
  })

  it('keeps the same interpolation placeholders per key', () => {
    for (const key of Object.keys(frFlat)) {
      expect(placeholders(enFlat[key]!), key).toEqual(placeholders(frFlat[key]!))
    }
  })
})
