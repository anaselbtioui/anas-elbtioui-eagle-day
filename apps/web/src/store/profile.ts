import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/services/api.ts'
import {
  createDeviceWallet,
  emptyWallet,
  isLegacySharedWallet,
  migrateDeviceWallet,
  migrateWalletNames,
  needsDeviceWallet,
  domainToWallet,
  walletToDomain,
  type Wallet,
} from '@/services/wallet.ts'

interface ProfileState {
  profile: Wallet
  saving: boolean
  error: string | null
  setProfile: (patch: Partial<Wallet>) => void
  ensureDeviceWallet: () => void
  /** Best-effort server sync of domain-mapped fields (step advance). */
  persistDraft: () => Promise<void>
  /** Merge server profile into local wallet (cross-device / refresh). */
  pullRemoteProfile: () => Promise<void>
  completeOnboarding: () => Promise<void>
  reset: () => void
}

/** Fields typed before device ids exist — keep when provisioning. */
const DRAFT_KEYS = [
  'firstName',
  'lastName',
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
  'licensePhotoPath',
  'carteGrisePhotoPath',
  'attestationPhotoPath',
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
      persistDraft: async () => {
        const wallet = get().profile
        if (!wallet.motoristId.trim()) return
        try {
          let next = wallet
          const docs: Array<{
            kind: 'license' | 'carteGrise' | 'attestation'
            local: string
            pathKey: 'licensePhotoPath' | 'carteGrisePhotoPath' | 'attestationPhotoPath'
          }> = [
            {
              kind: 'license',
              local: wallet.licensePhotoLocal,
              pathKey: 'licensePhotoPath',
            },
            {
              kind: 'carteGrise',
              local: wallet.carteGrisePhotoLocal,
              pathKey: 'carteGrisePhotoPath',
            },
            {
              kind: 'attestation',
              local: wallet.attestationPhotoLocal,
              pathKey: 'attestationPhotoPath',
            },
          ]
          for (const doc of docs) {
            if (!doc.local.startsWith('data:')) continue
            try {
              const { path } = await api.uploadProfileDoc(doc.kind, doc.local)
              next = { ...next, [doc.pathKey]: path }
            } catch {
              /* storage optional in local json mode */
            }
          }
          if (next !== wallet) set({ profile: next })
          await api.saveProfile(walletToDomain(next))
        } catch {
          /* local persist already has draft; server sync best-effort */
        }
      },
      pullRemoteProfile: async () => {
        const cur = get().profile
        if (!cur.motoristId.trim()) return
        try {
          const remote = await api.getProfile()
          let next = domainToWallet(remote, cur)
          const prefer = (local: string, fromRemote: string) =>
            local.trim() ? local : fromRemote
          next = {
            ...next,
            firstName: prefer(cur.firstName, next.firstName),
            lastName: prefer(cur.lastName, next.lastName),
            phone: prefer(cur.phone, next.phone),
            plate: prefer(cur.plate, next.plate),
            vehicle: prefer(cur.vehicle, next.vehicle),
            insurer: prefer(cur.insurer, next.insurer),
            policy: prefer(cur.policy, next.policy),
            broker: prefer(cur.broker, next.broker),
            brokerId: prefer(cur.brokerId, next.brokerId),
            city: prefer(cur.city, next.city),
            cin: prefer(cur.cin, next.cin),
            licenseNumber: prefer(cur.licenseNumber, next.licenseNumber),
            attestationValidUntil: prefer(
              cur.attestationValidUntil,
              next.attestationValidUntil,
            ),
            licensePhotoPath: prefer(cur.licensePhotoPath, next.licensePhotoPath),
            carteGrisePhotoPath: prefer(
              cur.carteGrisePhotoPath,
              next.carteGrisePhotoPath,
            ),
            attestationPhotoPath: prefer(
              cur.attestationPhotoPath,
              next.attestationPhotoPath,
            ),
            licensePhotoLocal: cur.licensePhotoLocal,
            carteGrisePhotoLocal: cur.carteGrisePhotoLocal,
            attestationPhotoLocal: cur.attestationPhotoLocal,
            onboardingStep: cur.onboardingStep,
            onboarded: cur.onboarded,
            phoneVerified: cur.phoneVerified,
          }
          const fillPhoto = async (
            kind: 'license' | 'carteGrise' | 'attestation',
            path: string,
            local: string,
            key: 'licensePhotoLocal' | 'carteGrisePhotoLocal' | 'attestationPhotoLocal',
          ) => {
            if (!path || local.startsWith('data:')) return
            try {
              const { url } = await api.profileDocUrl(kind)
              next = { ...next, [key]: url }
            } catch {
              /* ignore */
            }
          }
          await fillPhoto(
            'license',
            next.licensePhotoPath,
            next.licensePhotoLocal,
            'licensePhotoLocal',
          )
          await fillPhoto(
            'carteGrise',
            next.carteGrisePhotoPath,
            next.carteGrisePhotoLocal,
            'carteGrisePhotoLocal',
          )
          await fillPhoto(
            'attestation',
            next.attestationPhotoPath,
            next.attestationPhotoLocal,
            'attestationPhotoLocal',
          )
          set({ profile: next })
        } catch {
          /* offline / no remote profile yet */
        }
      },
      completeOnboarding: async () => {
        set({ saving: true, error: null })
        try {
          if (needsDeviceWallet(get().profile) || isLegacySharedWallet(get().profile)) {
            get().ensureDeviceWallet()
          }
          await get().persistDraft()
          const next = { ...get().profile, onboarded: true, onboardingStep: 0 }
          if (!next.brokerId.trim()) {
            set({ saving: false, error: 'broker_required' })
            throw new Error('broker_required')
          }
          await api.saveProfile(walletToDomain(next))
          await api.completeProfile()
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
        const p = persisted as { profile?: Partial<Wallet> & { name?: string } } | undefined
        const merged = migrateWalletNames({
          ...emptyWallet,
          ...current.profile,
          ...p?.profile,
        } as Wallet & { name?: string })
        return {
          ...current,
          ...p,
          profile: migrateDeviceWallet(merged),
        }
      },
    },
  ),
)
