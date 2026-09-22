import { create } from 'zustand'
import type { DeskBundle, DocumentRequestPiece, MessageIntent } from '@/domain/desk.ts'
import { api } from '@/services/api.ts'

interface BrokerDeskState {
  bundles: DeskBundle[]
  searchQuery: string
  toast: string | null
  loading: boolean
  error: string | null
  setSearchQuery: (query: string) => void
  loadQueue: () => Promise<void>
  loadOne: (dossierId: string) => Promise<DeskBundle | null>
  getBundle: (dossierId: string) => DeskBundle | undefined
  requestPiece: (
    dossierId: string,
    piece: DocumentRequestPiece,
    note: string,
  ) => Promise<void>
  addDraft: (
    dossierId: string,
    intent: MessageIntent,
    pieceLabel?: string,
  ) => Promise<string | null>
  setHumanApproved: (dossierId: string, draftId: string, value: boolean) => Promise<void>
  setDraftBody: (dossierId: string, draftId: string, body: string) => Promise<void>
  setOwner: (dossierId: string, owner: string) => Promise<void>
  handoff: (dossierId: string) => Promise<boolean>
  approveMessage: (dossierId: string, draftId: string) => Promise<boolean>
  toggleTaskDone: (dossierId: string, taskId: string) => Promise<void>
  clearToast: () => void
}

function replaceBundle(bundles: DeskBundle[], next: DeskBundle): DeskBundle[] {
  const i = bundles.findIndex((b) => b.dossierId === next.dossierId)
  if (i === -1) return [next, ...bundles]
  const copy = [...bundles]
  copy[i] = next
  return copy
}

export const useBrokerDeskStore = create<BrokerDeskState>((set, get) => ({
  bundles: [],
  searchQuery: '',
  toast: null,
  loading: false,
  error: null,
  setSearchQuery: (query) => set({ searchQuery: query }),
  loadQueue: async () => {
    set({ loading: true, error: null })
    try {
      const bundles = await api.listBrokerQueue()
      set({ bundles, loading: false })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'load_failed',
      })
    }
  },
  loadOne: async (dossierId) => {
    try {
      const bundle = await api.getBrokerDossier(dossierId)
      set((s) => ({ bundles: replaceBundle(s.bundles, bundle) }))
      return bundle
    } catch {
      return null
    }
  },
  getBundle: (dossierId) => get().bundles.find((b) => b.dossierId === dossierId),
  requestPiece: async (dossierId, piece, note) => {
    const next = await api.requestBrokerPiece(dossierId, piece, note)
    set((s) => ({
      bundles: replaceBundle(s.bundles, next),
      toast: 'Demande enregistrée',
    }))
  },
  addDraft: async (dossierId, intent, pieceLabel) => {
    const next = await api.createBrokerDraft(dossierId, intent, pieceLabel)
    set((s) => ({ bundles: replaceBundle(s.bundles, next) }))
    return next.drafts[0]?.id ?? null
  },
  setHumanApproved: async (dossierId, draftId, value) => {
    const next = await api.setBrokerDraftApproved(dossierId, draftId, value)
    set((s) => ({ bundles: replaceBundle(s.bundles, next) }))
  },
  setDraftBody: async (dossierId, draftId, body) => {
    const next = await api.setBrokerDraftBody(dossierId, draftId, body)
    set((s) => ({ bundles: replaceBundle(s.bundles, next) }))
  },
  setOwner: async (dossierId, owner) => {
    const next = await api.setBrokerOwner(dossierId, owner)
    set((s) => ({ bundles: replaceBundle(s.bundles, next) }))
  },
  handoff: async (dossierId) => {
    try {
      const next = await api.handoffBrokerDossier(dossierId)
      set((s) => ({
        bundles: replaceBundle(s.bundles, next),
        toast: 'Transmis',
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      set({
        toast: message === 'has_gaps' ? 'Écarts présents' : 'Impossible',
      })
      return false
    }
  },
  approveMessage: async (dossierId, draftId) => {
    try {
      const next = await api.approveBrokerDraft(dossierId, draftId)
      set((s) => ({
        bundles: replaceBundle(s.bundles, next),
        toast: 'Brouillon approuvé',
      }))
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      set({
        toast: message === 'not_human_approved' ? 'Validation requise' : 'Introuvable',
      })
      return false
    }
  },
  toggleTaskDone: async (dossierId, taskId) => {
    const next = await api.toggleBrokerTask(dossierId, taskId)
    set((s) => ({ bundles: replaceBundle(s.bundles, next) }))
  },
  clearToast: () => set({ toast: null }),
}))
