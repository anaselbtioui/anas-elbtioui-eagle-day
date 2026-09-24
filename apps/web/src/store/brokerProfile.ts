import { create } from 'zustand'
import { api } from '@/services/api.ts'
import type { BrokerProfile } from '@/services/http-contract.ts'
import { isPersonName } from '@/domain/ma-fields.ts'
import { isValidMoroccanPhone } from '@/lib/phone'

export type BrokerProfileDraft = {
  firstName: string
  lastName: string
  phone: string
  email: string
  displayName: string
  avatarPhotoLocal: string
  avatarPhotoPath: string
}

export function emptyBrokerDraft(): BrokerProfileDraft {
  return {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    displayName: '',
    avatarPhotoLocal: '',
    avatarPhotoPath: '',
  }
}

export function brokerDraftFromApi(
  profile: BrokerProfile,
  avatarLocal = '',
): BrokerProfileDraft {
  return {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    displayName: profile.displayName ?? '',
    avatarPhotoLocal: avatarLocal,
    avatarPhotoPath: profile.avatarPhotoPath ?? '',
  }
}

export function countBrokerDraftChanges(
  draft: BrokerProfileDraft,
  baseline: BrokerProfileDraft,
): number {
  let n = 0
  for (const key of ['firstName', 'lastName', 'phone'] as const) {
    if (draft[key].trim() !== baseline[key].trim()) n += 1
  }
  if (
    draft.avatarPhotoLocal.trim() !== baseline.avatarPhotoLocal.trim() ||
    draft.avatarPhotoPath.trim() !== baseline.avatarPhotoPath.trim()
  ) {
    n += 1
  }
  return n
}

export function brokerDraftSaveOk(draft: BrokerProfileDraft): boolean {
  if (!draft.firstName.trim() || !isPersonName(draft.firstName)) return false
  if (!draft.lastName.trim() || !isPersonName(draft.lastName)) return false
  if (draft.phone.trim() && !isValidMoroccanPhone(draft.phone)) return false
  return true
}

function keepInflightPhoto(local: string): string {
  return local.startsWith('data:') ? local : ''
}

type BrokerProfileState = {
  profile: BrokerProfileDraft
  remoteHydrated: boolean
  saving: boolean
  error: string | null
  pullRemote: () => Promise<void>
  setDraft: (patch: Partial<BrokerProfileDraft>) => void
  replaceDraft: (draft: BrokerProfileDraft) => void
  persistDraft: () => Promise<BrokerProfileDraft>
  reset: () => void
}

export const useBrokerProfileStore = create<BrokerProfileState>()((set, get) => ({
  profile: emptyBrokerDraft(),
  remoteHydrated: false,
  saving: false,
  error: null,
  pullRemote: async () => {
    try {
      const remote = await api.getBrokerProfile()
      let avatarLocal = ''
      if (remote.avatarPhotoPath) {
        try {
          const { url } = await api.brokerAvatarUrl()
          avatarLocal = url
        } catch {
          /* storage optional */
        }
      }
      const cur = get().profile
      set({
        profile: brokerDraftFromApi(remote, keepInflightPhoto(cur.avatarPhotoLocal) || avatarLocal),
        remoteHydrated: true,
        error: null,
      })
    } catch (err) {
      set({
        remoteHydrated: true,
        error: err instanceof Error ? err.message : 'load_failed',
      })
    }
  },
  setDraft: (patch) => {
    set({ profile: { ...get().profile, ...patch } })
  },
  replaceDraft: (draft) => {
    set({ profile: draft })
  },
  persistDraft: async () => {
    const wallet = get().profile
    set({ saving: true, error: null })
    try {
      let avatarPath = wallet.avatarPhotoPath.trim() || null
      let avatarLocal = wallet.avatarPhotoLocal
      if (wallet.avatarPhotoLocal.startsWith('data:')) {
        try {
          const { path } = await api.uploadBrokerAvatar(wallet.avatarPhotoLocal)
          avatarPath = path
          try {
            const { url } = await api.brokerAvatarUrl()
            avatarLocal = url
          } catch {
            avatarLocal = ''
          }
        } catch {
          /* storage optional in local json mode */
        }
      } else if (!wallet.avatarPhotoLocal.trim()) {
        avatarPath = null
        avatarLocal = ''
      }

      const saved = await api.saveBrokerProfile({
        firstName: wallet.firstName.trim(),
        lastName: wallet.lastName.trim(),
        phone: wallet.phone.trim(),
        avatarPhotoPath: avatarPath,
      })
      const next = brokerDraftFromApi(saved, avatarLocal)
      set({ profile: next, saving: false, error: null })
      try {
        const { useSessionStore } = await import('@/store/session.ts')
        useSessionStore.getState().patchUser(saved.user)
      } catch {
        /* circular import edge */
      }
      return next
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : 'save_failed',
      })
      throw err
    }
  },
  reset: () =>
    set({
      profile: emptyBrokerDraft(),
      remoteHydrated: false,
      saving: false,
      error: null,
    }),
}))
