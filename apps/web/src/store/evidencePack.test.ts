import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyPack, evidenceReducer } from '@/domain/evidence'
import type { EvidencePack as DomainPack } from '@/domain/types.ts'
import { fromDomainPack, toDomainPack } from '@/services/pack-map.ts'
import { emptyWallet } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile.ts'
import {
  EVIDENCE_STORAGE_KEY,
  mergeHydratePacks,
  migrateLegacyEvidenceStorage,
  resolveActiveAfterHydrate,
  useEvidenceStore,
} from '@/store/evidencePack'

const listPacks = vi.fn()
const savePack = vi.fn().mockResolvedValue(undefined)
const createPack = vi.fn()

vi.mock('@/services/api.ts', () => ({
  api: {
    listPacks: (...args: unknown[]) => listPacks(...args),
    savePack: (...args: unknown[]) => savePack(...args),
    createPack: (...args: unknown[]) => createPack(...args),
  },
}))

function domainStarted(id: string, city = 'Casablanca'): DomainPack {
  return {
    incident: {
      id,
      ref: `REF-${id}`,
      motoristId: 'M-1',
      policyId: null,
      occurredAt: '2026-09-20T10:00:00.000Z',
      city,
      injury: 'no',
      vehicleImmobilised: false,
      otherPartyId: null,
      workCommute: null,
      archivedAt: null,
    },
    otherParty: null,
    evidence: {
      incidentId: id,
      constat: 'started',
      pv: 'not_needed',
      damageZones: [],
      photos: [],
    },
  }
}

describe('archive round-trip', () => {
  it('persists archivedAt on the domain incident', () => {
    let ui = createEmptyPack()
    ui.id = 'INC-arch'
    ui.injury = 'no'
    ui.status = 'stopped'
    ui.stopReason = 'other'
    ui.archivedAt = '2026-09-23T15:00:00.000Z'
    const domain = toDomainPack(ui, { motoristId: 'M-1', policyId: null, city: 'Fès' })
    expect(domain.incident.archivedAt).toBe('2026-09-23T15:00:00.000Z')
    const back = fromDomainPack(domain)
    expect(back.archivedAt).toBe('2026-09-23T15:00:00.000Z')
    expect(back.status).toBe('stopped')
  })

  it('clears archive on unarchive mapping', () => {
    const ui = {
      ...createEmptyPack(),
      id: 'INC-arch-2',
      injury: 'no' as const,
      status: 'expired' as const,
      archivedAt: null,
    }
    const domain = toDomainPack(ui, { motoristId: 'M-1', policyId: null, city: null })
    expect(domain.incident.archivedAt).toBeNull()
  })

  it('round-trips user cancel (stopped) without injury answer', () => {
    let ui = createEmptyPack()
    ui.id = 'INC-cancel'
    ui = evidenceReducer(ui, { type: 'STOP', reason: 'other' })
    expect(ui.status).toBe('stopped')
    const domain = toDomainPack(ui, { motoristId: 'M-1', policyId: null, city: 'Fès' })
    expect(domain.evidence.pv).toBe('required')
    expect(domain.incident.injury).toBe('no')
    const back = fromDomainPack(domain)
    expect(back.status).toBe('stopped')
    expect(back.stopReason).toBe('other')
  })
})

describe('resolveActiveAfterHydrate', () => {
  it('keeps dirty local active pack', () => {
    const local = { ...createEmptyPack(), id: 'A', city: 'local-city' }
    const server = [fromDomainPack(domainStarted('A', 'server-city'))]
    const kept = resolveActiveAfterHydrate(local, server, 'A', () => false)
    expect(kept?.city).toBe('local-city')
  })

  it('keeps local when offline queue owns the incident', () => {
    const local = { ...createEmptyPack(), id: 'Q', city: 'queued' }
    const server = [fromDomainPack(domainStarted('Q', 'server'))]
    const kept = resolveActiveAfterHydrate(local, server, null, (id) => id === 'Q')
    expect(kept?.city).toBe('queued')
  })

  it('replaces clean active with server row', () => {
    const local = { ...createEmptyPack(), id: 'A', city: 'stale' }
    const server = [fromDomainPack(domainStarted('A', 'fresh'))]
    const next = resolveActiveAfterHydrate(local, server, null, () => false)
    expect(next?.city).toBe('fresh')
  })

  it('drops clean active missing from server', () => {
    const local = { ...createEmptyPack(), id: 'gone' }
    const next = resolveActiveAfterHydrate(local, [], null, () => false)
    expect(next).toBeNull()
  })
})

describe('mergeHydratePacks', () => {
  it('keeps dirty history row over server', () => {
    const localHistory = [{ ...createEmptyPack(), id: 'H', city: 'local-hist' }]
    const server = [fromDomainPack(domainStarted('H', 'server-hist'))]
    const merged = mergeHydratePacks(server, null, localHistory, 'H', () => false)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.city).toBe('local-hist')
  })

  it('reinserts local-only dirty pack missing from server', () => {
    const local = { ...createEmptyPack(), id: 'solo', city: 'only-here' }
    const merged = mergeHydratePacks(
      [fromDomainPack(domainStarted('other'))],
      local,
      [],
      'solo',
      () => false,
    )
    expect(merged.map((p) => p.id).sort()).toEqual(['other', 'solo'])
    expect(merged.find((p) => p.id === 'solo')?.city).toBe('only-here')
  })
})

describe('hydrateFromDomain server-wins', () => {
  beforeEach(() => {
    useEvidenceStore.getState().resetAll()
  })

  it('tracks packsStatus loading then ready', () => {
    expect(useEvidenceStore.getState().packsStatus).toBe('idle')
    useEvidenceStore.getState().beginPacksLoad()
    expect(useEvidenceStore.getState().packsStatus).toBe('loading')
    useEvidenceStore.getState().finishPacksLoad()
    expect(useEvidenceStore.getState().packsStatus).toBe('ready')
    // Idempotent: stay ready even if begin is called again.
    useEvidenceStore.getState().beginPacksLoad()
    expect(useEvidenceStore.getState().packsStatus).toBe('ready')
  })

  it('finishPacksLoad marks ready after a failed fetch path', () => {
    useEvidenceStore.getState().beginPacksLoad()
    useEvidenceStore.getState().finishPacksLoad()
    expect(useEvidenceStore.getState().packsStatus).toBe('ready')
  })

  it('resetAll clears packsStatus to idle', () => {
    useEvidenceStore.getState().beginPacksLoad()
    useEvidenceStore.getState().finishPacksLoad()
    useEvidenceStore.getState().resetAll()
    expect(useEvidenceStore.getState().packsStatus).toBe('idle')
  })

  it('replaces stale history with server rows', () => {
    useEvidenceStore.setState({
      pack: null,
      history: [{ ...createEmptyPack(), id: 'old', city: 'stale' }],
      dirtyPackId: null,
    })
    useEvidenceStore.getState().hydrateFromDomain([domainStarted('new', 'Fes')])
    const { history, pack } = useEvidenceStore.getState()
    expect(pack).toBeNull()
    expect(history.map((h) => h.id)).toEqual(['new'])
    expect(history[0]?.city).toBe('Fes')
  })

  it('does not clobber dirty active pack', () => {
    const dirty = { ...createEmptyPack(), id: 'NOW', city: 'editing', injury: 'yes' as const }
    useEvidenceStore.setState({ pack: dirty, history: [], dirtyPackId: 'NOW' })
    useEvidenceStore.getState().hydrateFromDomain([domainStarted('NOW', 'server')])
    expect(useEvidenceStore.getState().pack?.city).toBe('editing')
    expect(useEvidenceStore.getState().dirtyPackId).toBe('NOW')
  })

  it('keeps dirty history row across hydrate', () => {
    const dirtyHist = {
      ...createEmptyPack(),
      id: 'H1',
      city: 'editing-hist',
      injury: 'yes' as const,
      status: 'saved' as const,
    }
    useEvidenceStore.setState({
      pack: null,
      history: [dirtyHist],
      dirtyPackId: 'H1',
    })
    useEvidenceStore.getState().hydrateFromDomain([domainStarted('H1', 'server')])
    expect(useEvidenceStore.getState().history[0]?.city).toBe('editing-hist')
  })

  it('drops clean active pack missing from server', () => {
    useEvidenceStore.setState({
      pack: { ...createEmptyPack(), id: 'ghost' },
      history: [],
      dirtyPackId: null,
    })
    useEvidenceStore.getState().hydrateFromDomain([domainStarted('other')])
    expect(useEvidenceStore.getState().pack).toBeNull()
    expect(useEvidenceStore.getState().history.map((h) => h.id)).toEqual(['other'])
  })
})

describe('migrateLegacyEvidenceStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    listPacks.mockReset()
    savePack.mockClear()
    useProfileStore.setState({
      profile: { ...emptyWallet, motoristId: 'M-1' },
      serverProfile: { ...emptyWallet, motoristId: 'M-1' },
      draft: {},
      error: null,
      saving: false,
    })
    useEvidenceStore.getState().resetAll()
  })

  it('saves only unknown ids then removes labas-evidence-v3', async () => {
    listPacks.mockResolvedValue([domainStarted('known')])
    const unknown = {
      ...createEmptyPack(),
      id: 'unknown-local',
      injury: 'yes' as const,
      status: 'saved' as const,
    }
    const knownLocal = {
      ...createEmptyPack(),
      id: 'known',
      injury: 'yes' as const,
      status: 'saved' as const,
      city: 'should-not-overwrite',
    }
    localStorage.setItem(
      EVIDENCE_STORAGE_KEY,
      JSON.stringify({
        state: { pack: unknown, history: [knownLocal] },
      }),
    )
    await migrateLegacyEvidenceStorage()
    expect(localStorage.getItem(EVIDENCE_STORAGE_KEY)).toBeNull()
    expect(savePack).toHaveBeenCalledTimes(1)
    const saved = savePack.mock.calls[0]?.[0] as DomainPack
    expect(saved.incident.id).toBe('unknown-local')
  })

  it('keeps key when listPacks fails', async () => {
    listPacks.mockRejectedValue(new Error('offline'))
    localStorage.setItem(
      EVIDENCE_STORAGE_KEY,
      JSON.stringify({
        state: {
          pack: {
            ...createEmptyPack(),
            id: 'keep-me',
            injury: 'yes',
            status: 'saved',
          },
        },
      }),
    )
    await migrateLegacyEvidenceStorage()
    expect(localStorage.getItem(EVIDENCE_STORAGE_KEY)).not.toBeNull()
    expect(savePack).not.toHaveBeenCalled()
  })

  it('keeps key when savePack fails for unknown id', async () => {
    listPacks.mockResolvedValue([])
    savePack.mockRejectedValueOnce(new Error('503'))
    localStorage.setItem(
      EVIDENCE_STORAGE_KEY,
      JSON.stringify({
        state: {
          pack: {
            ...createEmptyPack(),
            id: 'fail-upload',
            injury: 'yes',
            status: 'saved',
          },
        },
      }),
    )
    await migrateLegacyEvidenceStorage()
    expect(localStorage.getItem(EVIDENCE_STORAGE_KEY)).not.toBeNull()
  })
})
