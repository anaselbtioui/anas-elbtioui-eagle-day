import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  createEmptyPack,
  evidenceReducer,
  type EvidenceAction,
  type EvidencePack,
} from '@/domain/evidence'
import type { EvidencePack as DomainPack } from '@/domain/types.ts'
import { api } from '@/services/api.ts'
import {
  enqueueCreatePack,
  enqueueSavePack,
  flushOfflinePackQueue,
  isBrowserOnline,
  isNetworkFailure,
  type OfflineIdRemap,
} from '@/services/offline-pack-queue.ts'
import { fromDomainPack, packLooksStarted, toDomainPack } from '@/services/pack-map.ts'
import { useProfileStore } from '@/store/profile.ts'

interface EvidenceState {
  pack: EvidencePack | null
  history: EvidencePack[]
  starting: boolean
  error: string | null
  start: () => Promise<void>
  /** Park current active if needed, then make this pack the NOW active. */
  resume: (id: string) => boolean
  dispatch: (action: EvidenceAction) => void
  persistActive: () => Promise<void>
  hydrateFromDomain: (packs: DomainPack[]) => void
  clearActive: () => void
  resetAll: () => void
}

/** Serial chain for NOW pack writes — online API calls and offline queue flush share it. */
let persistChain: Promise<void> = Promise.resolve()

function ctx() {
  const p = useProfileStore.getState().profile
  return {
    motoristId: p.motoristId,
    policyId: p.policyId,
    city: p.city.trim() || null,
  }
}

function applyRemaps(remaps: OfflineIdRemap[]) {
  if (remaps.length === 0) return
  const { pack, history } = useEvidenceStore.getState()
  let nextPack = pack
  let nextHistory = history
  for (const { from, to } of remaps) {
    if (nextPack?.id === from) nextPack = { ...nextPack, id: to }
    nextHistory = nextHistory.map((h) => (h.id === from ? { ...h, id: to } : h))
  }
  useEvidenceStore.setState({ pack: nextPack, history: nextHistory })
}

function pushPack(ui: EvidencePack): Promise<void> {
  if (!ui.injury) return Promise.resolve()
  persistChain = persistChain
    .catch(() => undefined)
    .then(async () => {
      const domain = toDomainPack(ui, ctx())
      if (!isBrowserOnline()) {
        enqueueSavePack(domain)
        return
      }
      try {
        await api.savePack(domain)
      } catch (err) {
        if (isNetworkFailure(err)) {
          enqueueSavePack(domain)
          return
        }
        throw err
      }
    })
  return persistChain
}

function startOfflinePack(): EvidencePack {
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()
  enqueueCreatePack(
    {
      motoristId: ctx().motoristId,
      city: ctx().city,
    },
    id,
  )
  return {
    ...createEmptyPack(),
    id,
    createdAt,
  }
}

/** Flush localStorage offline queue (createPack / savePack / …) via persistChain. */
export function flushEvidenceOfflineQueue(): Promise<void> {
  persistChain = persistChain
    .catch(() => undefined)
    .then(async () => {
      const remaps = await flushOfflinePackQueue()
      applyRemaps(remaps)
    })
  return persistChain
}

let offlineReplayInstalled = false

/** Call once at app boot: replay on start + whenever the browser goes online. */
export function installEvidenceOfflineReplay() {
  if (offlineReplayInstalled || typeof window === 'undefined') return
  offlineReplayInstalled = true
  void flushEvidenceOfflineQueue().catch(() => undefined)
  window.addEventListener('online', () => {
    void flushEvidenceOfflineQueue().catch(() => undefined)
  })
}

export const useEvidenceStore = create<EvidenceState>()(
  persist(
    (set, get) => ({
      pack: null,
      history: [],
      starting: false,
      error: null,
      start: async () => {
        set({ starting: true, error: null })
        try {
          const current = get().pack
          if (current) {
            set({
              history: [current, ...get().history.filter((h) => h.id !== current.id)].slice(0, 20),
              pack: null,
            })
          }
          if (!isBrowserOnline()) {
            set({ pack: startOfflinePack(), starting: false })
            return
          }
          let created: DomainPack
          try {
            created = await api.createPack({
              motoristId: ctx().motoristId,
              city: ctx().city,
            })
          } catch (err) {
            if (isNetworkFailure(err)) {
              set({ pack: startOfflinePack(), starting: false })
              return
            }
            throw err
          }
          const ui = {
            ...createEmptyPack(),
            id: created.incident.id,
            createdAt: created.incident.occurredAt ?? new Date().toISOString(),
          }
          set({ pack: ui, starting: false })
        } catch (err) {
          set({
            starting: false,
            error: err instanceof Error ? err.message : 'create_failed',
          })
          throw err
        }
      },
      resume: (id) => {
        const { pack, history } = get()
        if (pack?.id === id) return true
        const found = history.find((h) => h.id === id)
        if (!found) return false
        let nextHistory = history.filter((h) => h.id !== id)
        if (pack) {
          nextHistory = [pack, ...nextHistory.filter((h) => h.id !== pack.id)]
        }
        set({ pack: found, history: nextHistory.slice(0, 20) })
        return true
      },
      dispatch: (action) => {
        const current = get().pack
        if (!current) return
        const next = evidenceReducer(current, action)
        if (next.status === 'saved' || next.status === 'stopped') {
          set({
            pack: next,
            history: [next, ...get().history.filter((h) => h.id !== next.id)].slice(0, 20),
          })
        } else {
          set({ pack: next })
        }
        void pushPack(next).catch((err) => {
          set({ error: err instanceof Error ? err.message : 'save_failed' })
        })
      },
      persistActive: async () => {
        const current = get().pack
        if (!current) return
        await pushPack(current)
      },
      hydrateFromDomain: (packs) => {
        const history = packs.filter(packLooksStarted).map(fromDomainPack)
        set({ history })
      },
      clearActive: () => set({ pack: null }),
      resetAll: () => set({ pack: null, history: [], error: null }),
    }),
    {
      name: 'labas-evidence-v2',
      partialize: (s) => ({ pack: s.pack, history: s.history }),
    },
  ),
)
