import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  canArchivePack,
  canCancelPack,
  createEmptyPack,
  evidenceReducer,
  expireDraftPack,
  isNowDraftExpired,
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
import { accidentRefFromId } from '@/domain/accident-ref'
import { useProfileStore } from '@/store/profile.ts'

interface EvidenceState {
  pack: EvidencePack | null
  history: EvidencePack[]
  starting: boolean
  error: string | null
  start: () => Promise<void>
  /** Park current active if needed, then make this pack the NOW active. */
  resume: (id: string) => boolean
  /** Flip overdue drafts to expired (active kept as expired for NOW UI). */
  sweepExpired: (now?: number) => void
  dispatch: (action: EvidenceAction) => void
  persistActive: () => Promise<void>
  hydrateFromDomain: (packs: DomainPack[]) => void
  archivePack: (id: string) => boolean
  unarchivePack: (id: string) => boolean
  /** Stop an in-progress draft/saved pack (user cancel). */
  cancelPack: (id: string) => boolean
  clearActive: () => void
  resetAll: () => void
}

/** Apply a patch to the active pack or a history row by id. */
function patchPackById(
  pack: EvidencePack | null,
  history: EvidencePack[],
  id: string,
  patch: (p: EvidencePack) => EvidencePack,
): { pack: EvidencePack | null; history: EvidencePack[] } | null {
  if (pack?.id === id) {
    return { pack: patch(pack), history }
  }
  const idx = history.findIndex((h) => h.id === id)
  if (idx < 0) return null
  const next = [...history]
  next[idx] = patch(history[idx]!)
  return { pack, history: next }
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

/** Expire drafts past TTL; keep expired active so NOW can show closed UI. */
export function applyNowExpiry(
  pack: EvidencePack | null,
  history: EvidencePack[],
  now = Date.now(),
): { pack: EvidencePack | null; history: EvidencePack[] } {
  let nextHistory = history.map((h) => expireDraftPack(h, now))
  let nextPack = pack ? expireDraftPack(pack, now) : null
  if (nextPack?.status === 'expired') {
    nextHistory = [nextPack, ...nextHistory.filter((h) => h.id !== nextPack!.id)].slice(0, 20)
  }
  return { pack: nextPack, history: nextHistory }
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
  // Skip untouched empty drafts. Everything else (incl. archive / cancel) hits the API.
  if (ui.status === 'draft' && !ui.injury && !ui.stopReason) return Promise.resolve()
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
  const ref = accidentRefFromId(id)
  const createdAt = new Date().toISOString()
  enqueueCreatePack(
    {
      motoristId: ctx().motoristId,
      city: ctx().city,
      ref,
    },
    id,
  )
  return {
    ...createEmptyPack(),
    id,
    ref,
    createdAt,
    city: ctx().city,
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
  useEvidenceStore.getState().sweepExpired()
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
      sweepExpired: (now = Date.now()) => {
        const { pack, history } = applyNowExpiry(get().pack, get().history, now)
        set({ pack, history })
      },
      start: async () => {
        set({ starting: true, error: null })
        try {
          get().sweepExpired()
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
            ref: created.incident.ref || accidentRefFromId(created.incident.id),
            createdAt: created.incident.occurredAt ?? new Date().toISOString(),
            city: created.incident.city ?? ctx().city,
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
        get().sweepExpired()
        const { pack, history } = get()
        if (pack?.id === id) {
          if (pack.status === 'expired' || isNowDraftExpired(pack)) return false
          return true
        }
        const found = history.find((h) => h.id === id)
        if (!found) return false
        if (found.status === 'expired' || isNowDraftExpired(found)) return false
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
        if (current.status === 'expired' || isNowDraftExpired(current)) {
          get().sweepExpired()
          return
        }
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
        const mapped = packs.filter(packLooksStarted).map(fromDomainPack)
        const { pack, history } = applyNowExpiry(get().pack, mapped)
        set({ pack, history })
      },
      archivePack: (id) => {
        get().sweepExpired()
        const { pack, history } = get()
        const target = pack?.id === id ? pack : history.find((h) => h.id === id)
        if (!target || !canArchivePack(target)) return false
        const at = new Date().toISOString()
        const archived = { ...target, archivedAt: at, updatedAt: at }
        const next = patchPackById(pack, history, id, () => archived)
        if (!next) return false
        set(next)
        void pushPack(archived).catch((err) => {
          set({ error: err instanceof Error ? err.message : 'save_failed' })
        })
        return true
      },
      unarchivePack: (id) => {
        const { pack, history } = get()
        const target = pack?.id === id ? pack : history.find((h) => h.id === id)
        if (!target?.archivedAt) return false
        const at = new Date().toISOString()
        const restored = { ...target, archivedAt: null, updatedAt: at }
        const next = patchPackById(pack, history, id, () => restored)
        if (!next) return false
        set(next)
        void pushPack(restored).catch((err) => {
          set({ error: err instanceof Error ? err.message : 'save_failed' })
        })
        return true
      },
      cancelPack: (id) => {
        get().sweepExpired()
        const { pack, history } = get()
        const target = pack?.id === id ? pack : history.find((h) => h.id === id)
        if (!target || !canCancelPack(target)) return false
        const stopped = evidenceReducer(target, { type: 'STOP', reason: 'other' })
        if (pack?.id === id) {
          set({
            pack: stopped,
            history: [stopped, ...history.filter((h) => h.id !== id)].slice(0, 20),
          })
        } else {
          set({
            history: history.map((h) => (h.id === id ? stopped : h)),
          })
        }
        void pushPack(stopped).catch((err) => {
          set({ error: err instanceof Error ? err.message : 'save_failed' })
        })
        return true
      },
      clearActive: () => set({ pack: null }),
      resetAll: () => set({ pack: null, history: [], error: null }),
    }),
    {
      name: 'labas-evidence-v3',
      partialize: (s) => ({ pack: s.pack, history: s.history }),
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const pack = state.pack
          ? { ...state.pack, archivedAt: state.pack.archivedAt ?? null }
          : null
        const history = state.history.map((h) => ({
          ...h,
          archivedAt: h.archivedAt ?? null,
        }))
        const next = applyNowExpiry(pack, history)
        useEvidenceStore.setState(next)
      },
    },
  ),
)
