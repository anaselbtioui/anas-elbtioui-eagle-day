import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendEvent,
  approveDraft,
  createDraft,
  filterDeskBundles,
  handoffToInsurer,
  requestDocument,
  setDraftHumanApproved,
} from './desk.ts'
import { seedDeskBundles } from './desk-seed.ts'

describe('desk requestDocument', () => {
  it('sets waiting_motorist and lists missing piece', () => {
    const [nadia] = seedDeskBundles()
    const next = requestDocument(nadia, 'constat_or_pv', 'Merci de signer le constat.')
    expect(next.dossier.status).toBe('waiting_motorist')
    expect(next.dossier.missingPieces).toContain('constat_or_pv')
    expect(next.requests).toHaveLength(1)
    expect(next.tasks[0]?.label).toMatch(/constat|PV/i)
  })
})

describe('desk approveDraft', () => {
  let bundle = seedDeskBundles()[0]!

  beforeEach(() => {
    bundle = createDraft(seedDeskBundles()[0]!, 'missing_piece', 'constat')
  })

  it('blocks approve without human checkbox', () => {
    const draftId = bundle.drafts[0]!.id
    const result = approveDraft(bundle, draftId)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('not_human_approved')
  })

  it('approves when human checkbox set', () => {
    const draftId = bundle.drafts[0]!.id
    const checked = setDraftHumanApproved(bundle, draftId, true)
    const result = approveDraft(checked, draftId, '2026-09-19T12:00:00.000Z')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.bundle.drafts[0]?.approvedAt).toBe('2026-09-19T12:00:00.000Z')
    }
  })
})

describe('desk handoff guard', () => {
  it('blocks when missing pieces remain', () => {
    const [nadia] = seedDeskBundles()
    const result = handoffToInsurer(nadia)
    expect(result).toEqual({ error: 'has_gaps' })
  })

  it('sets with_insurer when gaps cleared', () => {
    const [nadia] = seedDeskBundles()
    const clear = {
      ...nadia,
      dossier: { ...nadia.dossier, missingPieces: [] as typeof nadia.dossier.missingPieces },
    }
    const result = handoffToInsurer(clear)
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.dossier.status).toBe('with_insurer')
      expect(result.events[0]?.label).toMatch(/assureur/i)
    }
  })
})

describe('desk appendEvent', () => {
  it('prepends event with actor and visibility', () => {
    const [nadia] = seedDeskBundles()
    const next = appendEvent(nadia, 'broker', 'Note interne', false, '2026-09-19T10:00:00.000Z')
    expect(next.events[0]).toMatchObject({
      actor: 'broker',
      label: 'Note interne',
      motoristVisible: false,
      at: '2026-09-19T10:00:00.000Z',
    })
    expect(next.events.length).toBe(nadia.events.length + 1)
  })
})

describe('desk search filter', () => {
  it('filters by name, city, status and sorts by freshness', () => {
    const bundles = seedDeskBundles().map((b, i) => ({
      ...b,
      provenance: {
        ...b.provenance,
        freshness: `2026-09-1${i}T12:00:00.000Z`,
        owner: i === 0 ? 'Salma' : 'Youssef',
      },
    }))

    const byCity = filterDeskBundles(bundles, {
      query: 'casablanca',
      status: 'all',
      mineOnly: false,
      brokerName: null,
    })
    expect(
      byCity.every((b) => (b.pack.incident.city ?? '').toLowerCase().includes('casablanca')),
    ).toBe(true)

    const byStatus = filterDeskBundles(bundles, {
      query: '',
      status: 'blocked_missing_evidence',
      mineOnly: false,
      brokerName: null,
    })
    expect(byStatus.every((b) => b.dossier.status === 'blocked_missing_evidence')).toBe(true)

    const mine = filterDeskBundles(bundles, {
      query: '',
      status: 'all',
      mineOnly: true,
      brokerName: 'Salma',
    })
    expect(mine).toHaveLength(1)
    expect(mine[0]?.provenance.owner).toBe('Salma')

    const sorted = filterDeskBundles(bundles, {
      query: '',
      status: 'all',
      mineOnly: false,
      brokerName: null,
    })
    expect(sorted[0]!.provenance.freshness >= sorted[1]!.provenance.freshness).toBe(true)
  })
})
