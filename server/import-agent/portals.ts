import type { ExtractedImport, ImportOutcome, ImportSource } from '../../src/domain/browser-import.ts'

export const PORTAL_URLS: Record<ImportSource, { login: string; register: string; origin: string }> = {
  TRT: {
    login: 'https://trtbroker.com/compte/connexion',
    register: 'https://trtbroker.com/compte/inscription',
    origin: 'https://trtbroker.com',
  },
  OuiAssur: {
    login: 'https://www.ouiassur.ma/login',
    register: 'https://www.ouiassur.ma/register',
    origin: 'https://www.ouiassur.ma',
  },
}

export function isAllowlistedUrl(url: string, source: ImportSource): boolean {
  try {
    const u = new URL(url)
    const allowed = new URL(PORTAL_URLS[source].origin)
    return u.hostname === allowed.hostname || u.hostname.endsWith(`.${allowed.hostname}`)
  } catch {
    return false
  }
}

/** Deterministic fixtures mirrored from `_old/app.js` importFixtures. */
export function fixtureExtract(
  _source: ImportSource,
  outcome: ImportOutcome,
): ExtractedImport | null {
  switch (outcome) {
    case 'new':
      return {
        name: 'Client importé (démo)',
        phone: null,
        policy: 'MA-AUTO-25001',
        vehicle: 'Citroën C3 · 2022',
        plate: null,
        city: 'Rabat',
      }
    case 'duplicate':
      return {
        name: 'Nadia El Mansouri',
        phone: '06•••••142',
        policy: 'MA-AUTO-24018',
        vehicle: 'Dacia Sandero · 2022',
        plate: '12345-A-50',
        city: 'Casablanca',
      }
    case 'conflict':
      return {
        name: 'Nadia El Mansouri',
        phone: '06•••••913',
        policy: 'MA-AUTO-24018',
        vehicle: 'Dacia Sandero · 2021',
        plate: '12345-A-50',
        city: 'Casablanca',
      }
    case 'interrupted':
      return null
  }
}

export function resolveImportMode(): 'live' | 'fixture' {
  const mode = (process.env.LABAS_IMPORT_MODE ?? '').toLowerCase()
  const hasKey = Boolean(process.env.DEEPSEEK_API_KEY?.trim())
  if (mode === 'fixture') return 'fixture'
  if (mode === 'live') return hasKey ? 'live' : 'fixture'
  return hasKey ? 'live' : 'fixture'
}
