import { create } from 'zustand'
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

export const PROFILE_STORAGE_KEY = 'labas-profile-v2'

interface ProfileState {
  profile: Wallet
  saving: boolean
  error: string | null
  /** False until first GET /api/profile attempt finishes (success or fail). */
  remoteHydrated: boolean
  setProfile: (patch: Partial<Wallet>) => void
  ensureDeviceWallet: () => void
  /** Debounced server sync of domain-mapped fields. */
  persistDraft: () => Promise<void>
  /** Flush pending draft immediately (complete onboarding). */
  persistDraftNow: () => Promise<void>
  /** Server wins — hydrate wallet from GET /api/profile. */
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

const PERSIST_DEBOUNCE_MS = 400

let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistWaiters: Array<() => void> = []
let persistChain: Promise<void> = Promise.resolve()

/** Test helper — cancel debounce so pulls/asserts stay deterministic. */
export function resetProfilePersistForTests(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  persistWaiters = []
  persistChain = Promise.resolve()
}

function keepInflightPhoto(local: string): string {
  return local.startsWith('data:') ? local : ''
}

async function flushPersistDraft(
  get: () => ProfileState,
  set: (partial: Partial<ProfileState> | ((s: ProfileState) => Partial<ProfileState>)) => void,
): Promise<void> {
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
    /* server sync best-effort — memory wallet remains */
  }
}

function schedulePersist(
  get: () => ProfileState,
  set: (partial: Partial<ProfileState> | ((s: ProfileState) => Partial<ProfileState>)) => void,
): Promise<void> {
  return new Promise((resolve) => {
    persistWaiters.push(resolve)
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      const waiters = persistWaiters
      persistWaiters = []
      persistChain = persistChain
        .then(() => flushPersistDraft(get, set))
        .catch(() => undefined)
        .then(() => {
          for (const w of waiters) w()
        })
    }, PERSIST_DEBOUNCE_MS)
  })
}

async function flushPersistNow(
  get: () => ProfileState,
  set: (partial: Partial<ProfileState> | ((s: ProfileState) => Partial<ProfileState>)) => void,
): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const waiters = persistWaiters
  persistWaiters = []
  await persistChain
  await flushPersistDraft(get, set)
  for (const w of waiters) w()
}

/**
 * One-shot: push legacy localStorage wallet to server, then delete the key.
 * Call after auth when motoristId is known.
 */
export async function migrateLegacyProfileStorage(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  let raw: string | null = null
  try {
    raw = localStorage.getItem(PROFILE_STORAGE_KEY)
  } catch {
    return
  }
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as {
      state?: { profile?: Partial<Wallet> & { name?: string } }
      profile?: Partial<Wallet> & { name?: string }
    }
    const blob = parsed.state?.profile ?? parsed.profile
    if (blob && typeof blob === 'object') {
      const migrated = migrateDeviceWallet(
        migrateWalletNames({
          ...emptyWallet,
          ...blob,
        } as Wallet & { name?: string }),
      )
      const cur = useProfileStore.getState().profile
      const next = {
        ...migrated,
        motoristId: cur.motoristId.trim() || migrated.motoristId,
        vehicleId: cur.vehicleId.trim() || migrated.vehicleId,
        insurerId: cur.insurerId.trim() || migrated.insurerId,
        brokerId: cur.brokerId.trim() || migrated.brokerId,
        policyId: cur.policyId.trim() || migrated.policyId,
        onboarded: cur.onboarded || migrated.onboarded,
      }
      useProfileStore.setState({ profile: next })
      if (next.motoristId.trim()) {
        await useProfileStore.getState().persistDraftNow()
      }
    }
  } catch {
    /* corrupt blob — still remove below */
  }
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export const useProfileStore = create<ProfileState>()((set, get) => ({
  profile: emptyWallet,
  saving: false,
  error: null,
  remoteHydrated: false,
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
  persistDraft: () => schedulePersist(get, set),
  persistDraftNow: () => flushPersistNow(get, set),
  pullRemoteProfile: async () => {
    // Don't clobber in-progress edits — wait out debounce / in-flight PUT first.
    if (persistTimer) return
    await persistChain
    const cur = get().profile
    if (!cur.motoristId.trim()) return
    try {
      const remote = await api.getProfile()
      // Remote wins for domain fields; keep inflight photos + client-only wallet fields.
      let next = domainToWallet(remote, {
        licensePhotoLocal: keepInflightPhoto(cur.licensePhotoLocal),
        carteGrisePhotoLocal: keepInflightPhoto(cur.carteGrisePhotoLocal),
        attestationPhotoLocal: keepInflightPhoto(cur.attestationPhotoLocal),
        assistanceNumber: cur.assistanceNumber,
        brokerPhone: cur.brokerPhone,
        onboardingStep: cur.onboardingStep,
      })
      // Auth onboarded is source of truth when true; keep local true across JWT lag after complete.
      let onboarded = cur.onboarded
      try {
        const { useSessionStore } = await import('@/store/session.ts')
        const user = useSessionStore.getState().user
        if (user?.role === 'motorist') {
          onboarded = Boolean(user.onboarded) || cur.onboarded
        }
      } catch {
        /* circular import edge — keep cur */
      }
      next = {
        ...next,
        onboarded,
        // Phase 1: valid stored phone counts as accepted (no SMS).
        phoneVerified: Boolean(next.phone.trim()) || cur.phoneVerified,
        assistanceNumber: cur.assistanceNumber,
        brokerPhone: cur.brokerPhone,
        onboardingStep: cur.onboardingStep,
      }

      const fillPhoto = async (
        kind: 'license' | 'carteGrise' | 'attestation',
        path: string,
        local: string,
        key: 'licensePhotoLocal' | 'carteGrisePhotoLocal' | 'attestationPhotoLocal',
      ) => {
        if (!path || local.startsWith('data:')) return
        // Signed URLs last ~1h — keep existing https URL across polls.
        if (/^https?:\/\//i.test(local)) return
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
      set({ profile: next, remoteHydrated: true })
    } catch {
      // Offline / no remote yet — still mark hydrated so UI can show auth seed.
      set({ remoteHydrated: true })
    }
  },
  completeOnboarding: async () => {
    set({ saving: true, error: null })
    try {
      if (needsDeviceWallet(get().profile) || isLegacySharedWallet(get().profile)) {
        get().ensureDeviceWallet()
      }
      await get().persistDraftNow()
      const next = { ...get().profile, onboarded: true, onboardingStep: 0 }
      if (!next.brokerId.trim()) {
        set({ saving: false, error: 'broker_required' })
        throw new Error('broker_required')
      }
      await api.saveProfile(walletToDomain(next))
      const session = await api.completeProfile()
      set({ profile: next, saving: false })
      try {
        const { useSessionStore } = await import('@/store/session.ts')
        useSessionStore.getState().applyAuth(session.token, session.user)
      } catch {
        /* session wire optional in isolated store tests */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'save_failed'
      set({
        saving: false,
        error: message,
      })
      throw err
    }
  },
  reset: () => set({ profile: createDeviceWallet(), error: null, remoteHydrated: false }),
}))

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __labasProfile?: typeof useProfileStore }).__labasProfile =
    useProfileStore
}
