import { describe, expect, it } from 'vitest'
import {
  classifyImport,
  createImportBundle,
  mergeImport,
  type ExtractedImport,
} from './browser-import.ts'
import { seedDeskBundles } from './desk-seed.ts'

const newExtract: ExtractedImport = {
  name: 'Client importé (démo)',
  phone: null,
  policy: 'MA-AUTO-25001',
  vehicle: 'Citroën C3 · 2022',
  plate: null,
  city: 'Rabat',
}

const nadiaDup: ExtractedImport = {
  name: 'Nadia El Mansouri',
  phone: '06•••••142',
  policy: 'MA-AUTO-24018',
  vehicle: 'Dacia Sandero · 2022',
  plate: '12345-A-50',
  city: 'Casablanca',
}

const nadiaConflict: ExtractedImport = {
  name: 'Nadia El Mansouri',
  phone: '06•••••913',
  policy: 'MA-AUTO-24018',
  vehicle: 'Dacia Sandero · 2021',
  plate: '12345-A-50',
  city: 'Casablanca',
}

describe('classifyImport', () => {
  it('classifies new when policy unknown', () => {
    const result = classifyImport(newExtract, seedDeskBundles())
    expect(result.outcome).toBe('new')
    expect(result.matchDossierId).toBeNull()
    expect(result.rows.some((r) => r.field === 'policy' && r.status === 'Nouveau')).toBe(true)
  })

  it('classifies duplicate when policy and fields match', () => {
    const result = classifyImport(nadiaDup, seedDeskBundles())
    expect(result.outcome).toBe('duplicate')
    expect(result.matchDossierId).toBe('DOS-1')
  })

  it('classifies conflict when policy matches but fields diverge', () => {
    const result = classifyImport(nadiaConflict, seedDeskBundles())
    expect(result.outcome).toBe('conflict')
    expect(result.matchDossierId).toBe('DOS-1')
    expect(result.rows.filter((r) => r.status === 'Conflit').map((r) => r.field)).toEqual(
      expect.arrayContaining(['phone', 'vehicle']),
    )
  })

  it('classifies interrupted when extract missing', () => {
    const result = classifyImport(null, seedDeskBundles())
    expect(result.outcome).toBe('interrupted')
    expect(result.rows).toHaveLength(0)
  })
})

describe('mergeImport', () => {
  it('creates desk bundle for new', () => {
    const bundles = seedDeskBundles()
    const classification = classifyImport(newExtract, bundles)
    const result = mergeImport({
      classification,
      extracted: newExtract,
      source: 'TRT',
      owner: 'Salma',
      bundles,
      now: '2026-09-19T12:00:00.000Z',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(true)
    expect(result.bundle.profile.policy.number).toBe('MA-AUTO-25001')
    expect(result.bundle.provenance.source).toBe('Import navigateur · TRT')
    expect(result.bundle.provenance.owner).toBe('Salma')
    expect(result.bundle.tasks[0]?.label).toMatch(/Vérifier/)
  })

  it('blocks duplicate merge', () => {
    const bundles = seedDeskBundles()
    const classification = classifyImport(nadiaDup, bundles)
    const result = mergeImport({
      classification,
      extracted: nadiaDup,
      source: 'OuiAssur',
      owner: 'Salma',
      bundles,
    })
    expect(result.ok).toBe(false)
  })

  it('requires resolutions for conflict then patches', () => {
    const bundles = seedDeskBundles()
    const classification = classifyImport(nadiaConflict, bundles)
    const incomplete = mergeImport({
      classification,
      extracted: nadiaConflict,
      source: 'TRT',
      owner: 'Salma',
      bundles,
    })
    expect(incomplete.ok).toBe(false)

    const result = mergeImport({
      classification,
      extracted: nadiaConflict,
      source: 'TRT',
      owner: 'Salma',
      bundles,
      resolutions: [
        { field: 'phone', choice: 'incoming' },
        { field: 'vehicle', choice: 'current' },
      ],
      now: '2026-09-19T13:00:00.000Z',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.created).toBe(false)
    expect(result.bundle.profile.motorist.phone).toBe('06•••••913')
    expect(result.bundle.profile.vehicle.makeModel).toBe('Dacia Sandero · 2022')
    expect(result.bundle.provenance.source).toBe('Import navigateur · TRT')
  })

  it('createImportBundle stamps provenance', () => {
    const bundle = createImportBundle({
      extracted: newExtract,
      source: 'OuiAssur',
      owner: 'Youssef',
    })
    expect(bundle.dossierId.startsWith('DOS-IMP-')).toBe(true)
    expect(bundle.provenance.source).toBe('Import navigateur · OuiAssur')
  })
})
