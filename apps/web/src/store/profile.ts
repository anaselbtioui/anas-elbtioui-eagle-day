import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/services/api.ts'
import {
  createDeviceWallet,
  emptyWallet,
  isLegacySharedWallet,
  migrateDeviceWallet,
  needsDeviceWallet,
  walletToDomain,
  type Wallet,
} from '@/services/wallet.ts'

interface ProfileState {
  profile: Wallet
  saving: boolean
  error: string | null
  setProfile: (patch: Partial<Wallet>) => void
  ensureDeviceWallet: () => void
  completeOnboarding: () => Promise<void>
  reset: () => void
}

/** Fields typed before device ids exist — keep when provisioning. */
const DRAFT_KEYS = [
  'name',
  'phone',
  'plate',
  'vehicle',
  'insurer',
  'policy',
  'broker',
  'brokerId',
  'brokerPhone',
  'assistanceNumber',
  'assistanceOnContract',
  'city',
  'cin',
  'licenseNumber',
  'licensePhotoLocal',
  'carteGrisePhotoLocal',
  'attestationPhotoLocal',
  'attestationValidUntil',
  'phoneVerified',
  'onboardingStep',
] as const satisfies ReadonlyArray<keyof Wallet>

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: emptyWallet,
      saving: false,
      error: null,
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      ensureDeviceWallet: () => {
        const current = get().profile
        if (!needsDeviceWallet(current) && !isLegacySharedWallet(current)) return
        const base = isLegacySharedWallet(current)
          ? migrateDeviceWallet(current)
          : createDeviceWallet()
        const draft = Object.fromEntries(
          DRAFT_KEYS.map((key) => [key, current[key]]),
        ) as Pick<Wallet, (typeof DRAFT_KEYS)[number]>
        set({
          profile: {
            ...base,
            ...draft,
            onboarded: needsDeviceWallet(current) ? false : current.onboarded,
          },
        })
      },
      completeOnboarding: async () => {
        set({ saving: true, error: null })
        try {
          if (needsDeviceWallet(get().profile) || isLegacySharedWallet(get().profile)) {
            get().ensureDeviceWallet()
          }
          const next = { ...get().profile, onboarded: true, onboardingStep: 0 }
          if (!next.brokerId.trim()) {
            set({ saving: false, error: 'broker_required' })
            throw new Error('broker_required')
          }
          await api.saveProfile(walletToDomain(next))
          set({ profile: next, saving: false })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'save_failed'
          set({
            saving: false,
            error: message,
          })
          throw err
        }
      },
      reset: () => set({ profile: createDeviceWallet(), error: null }),
    }),
    {
      name: 'labas-profile-v2',
      partialize: (s) => ({ profile: s.profile }),
      merge: (persisted, current) => {
        const p = persisted as { profile?: Partial<Wallet> } | undefined
        const merged: Wallet = { ...emptyWallet, ...current.profile, ...p?.profile }
        return {
          ...current,
          ...p,
          profile: migrateDeviceWallet(merged),
        }
      },
    },
  ),
)
