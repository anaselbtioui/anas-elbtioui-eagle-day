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
  PORTEFEUILLE_PROGRESS_FIELDS,
  walletToDomain,
  type Wallet,
} from '@/services/wallet.ts'

export const PROFILE_STORAGE_KEY = 'labas-profile-v2'

interface ProfileState {
  /** Merged view: {...serverProfile, ...draft}. UI reads this. */
  profile: Wallet
  /** Last acknowledged server snapshot. */
  serverProfile: Wallet
  /** Dirty fields not yet confirmed by a successful PUT. */
  draft: Partial<Wallet>
  saving: boolean
  error: string | null
  /** False until first GET /api/profile attempt finishes (success or fail). */
  remoteHydrated: boolean
  /** True while onboarding page or wallet nudge drawer is editing. */
  walletEditing: boolean
  setProfile: (patch: Partial<Wallet>) => void
  setWalletEditing: (editing: boolean) => void
  ensureDeviceWallet: () => void
  /** Debounced server sync of domain-mapped fields. */
  persistDraft: () => Promise<void>
  /** Flush pending draft immediately (complete onboarding). */
  persistDraftNow: () => Promise<void>
  /** Dismiss sole-broker auto-assign notice (server ack). */
  ackBrokerAutoAssign: () => Promise<void>
  /** Server wins for non-draft fields — hydrate from GET /api/profile. */
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
  'avatarPhotoLocal',
  'licensePhotoPath',
  'carteGrisePhotoPath',
  'attestationPhotoPath',
  'avatarPhotoPath',
  'attestationValidUntil',
  'phoneVerified',
  'onboardingStep',
] as const satisfies ReadonlyArray<keyof Wallet>

const PERSIST_DEBOUNCE_MS = 400

let persistTimer: ReturnType<typeof setTimeout> | null = null
let persistWaiters: Array<() => void> = []
let persistChain: Promise<void> = Promise.resolve()
/** Per-key edit revision — clear from draft only when PUT ack matches. */
let dirtyRevision: Partial<Record<keyof Wallet, number>> = {}
let nextRevision = 1

function mergeView(server: Wallet, draft: Partial<Wallet>): Wallet {
  return { ...server, ...draft }
}

function applyMerged(
  set: (partial: Partial<ProfileState> | ((s: ProfileState) => Partial<ProfileState>)) => void,
  server: Wallet,
  draft: Partial<Wallet>,
  extra?: Partial<ProfileState>,
): void {
  set({
    serverProfile: server,
    draft,
    profile: mergeView(server, draft),
    ...extra,
  })
}

/** Test helper — cancel debounce so pulls/asserts stay deterministic. */
export function resetProfilePersistForTests(): void {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  persistWaiters = []
  persistChain = Promise.resolve()
  dirtyRevision = {}
  nextRevision = 1
}

function keepInflightPhoto(local: string): string {
  return local.startsWith('data:') ? local : ''
}

function stringFilled(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== ''
}

const PROGRESS_FIELD_SET = new Set<string>(PORTEFEUILLE_PROGRESS_FIELDS)

/**
 * After a successful PUT of `sent`, drop draft keys whose revision still matches
 * the revision captured at send time (keys typed during the PUT stay dirty).
 * Never clear a portefeuille field the ack echoed empty — that snap-back looks
 * like "wallet finished then unfinished again" after close/pull.
 */
function clearAcknowledgedDraft(
  draft: Partial<Wallet>,
  sent: Partial<Wallet>,
  sentRevs: Partial<Record<keyof Wallet, number>>,
  ackServer: Wallet,
): Partial<Wallet> {
  const next = { ...draft }
  for (const key of Object.keys(sent) as Array<keyof Wallet>) {
    if (!(key in sentRevs)) continue
    if (dirtyRevision[key] !== sentRevs[key]) continue
    if (
      PROGRESS_FIELD_SET.has(key) &&
      stringFilled(sent[key]) &&
      !stringFilled(ackServer[key])
    ) {
      continue
    }
    delete next[key]
    delete dirtyRevision[key]
  }
  return next
}

async function flushPersistDraft(
  get: () => ProfileState,
  set: (partial: Partial<ProfileState> | ((s: ProfileState) => Partial<ProfileState>)) => void,
  retryOnConflict = true,
  opts?: { brokerAutoAssignAck?: boolean },
): Promise<void> {
  const state = get()
  const wallet = state.profile
  if (!wallet.motoristId.trim()) return

  // Snapshot draft + revisions at send time — later keystrokes bump revision.
  const sentDraft = { ...state.draft }
  const sentRevs: Partial<Record<keyof Wallet, number>> = {}
  for (const key of Object.keys(sentDraft) as Array<keyof Wallet>) {
    if (dirtyRevision[key] !== undefined) sentRevs[key] = dirtyRevision[key]
  }

  try {
    let toSave = wallet
    const pathPatches: Partial<Wallet> = {}
    const docs: Array<{
      kind: 'license' | 'carteGrise' | 'attestation' | 'avatar'
      local: string
      pathKey: 'licensePhotoPath' | 'carteGrisePhotoPath' | 'attestationPhotoPath' | 'avatarPhotoPath'
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
      {
        kind: 'avatar',
        local: wallet.avatarPhotoLocal,
        pathKey: 'avatarPhotoPath',
      },
    ]
    for (const doc of docs) {
      if (!doc.local.startsWith('data:')) continue
      try {
        const { path } = await api.uploadProfileDoc(doc.kind, doc.local)
        pathPatches[doc.pathKey] = path
        toSave = { ...toSave, [doc.pathKey]: path }
      } catch {
        /* storage optional in local json mode */
      }
    }

    // Merge photo paths into CURRENT store — never overwrite concurrent keystrokes.
    if (Object.keys(pathPatches).length > 0) {
      const cur = get()
      const nextDraft = { ...cur.draft, ...pathPatches }
      for (const key of Object.keys(pathPatches) as Array<keyof Wallet>) {
        dirtyRevision[key] = nextRevision++
        sentRevs[key] = dirtyRevision[key]!
        sentDraft[key] = pathPatches[key] as never
      }
      applyMerged(set, cur.serverProfile, nextDraft)
      toSave = mergeView(cur.serverProfile, nextDraft)
    }

    const saved = await api.saveProfile({
      ...walletToDomain(toSave),
      ...(opts?.brokerAutoAssignAck ? { brokerAutoAssignAck: true } : {}),
    })
    const cur = get()
    // Seed server from acknowledged save; keep draft keys typed during the PUT.
    const ackServer = domainToWallet(saved, {
      licensePhotoLocal: keepInflightPhoto(cur.profile.licensePhotoLocal),
      carteGrisePhotoLocal: keepInflightPhoto(cur.profile.carteGrisePhotoLocal),
      attestationPhotoLocal: keepInflightPhoto(cur.profile.attestationPhotoLocal),
      avatarPhotoLocal: keepInflightPhoto(cur.profile.avatarPhotoLocal),
      assistanceNumber: toSave.assistanceNumber,
      brokerPhone: toSave.brokerPhone,
      onboardingStep: toSave.onboardingStep,
      firstName: toSave.firstName,
      lastName: toSave.lastName,
      phoneVerified: toSave.phoneVerified,
      onboarded: cur.profile.onboarded,
    })
    const remainingDraft = clearAcknowledgedDraft(cur.draft, sentDraft, sentRevs, ackServer)
    applyMerged(set, ackServer, remainingDraft)
    const label = `${ackServer.firstName.trim()} ${ackServer.lastName.trim()}`.trim()
    if (label) {
      try {
        const { useSessionStore } = await import('@/store/session.ts')
        useSessionStore.getState().patchUser({ displayName: label })
      } catch {
        /* circular import edge */
      }
    }
  } catch (err) {
    /* Conflict: re-seed server, keep draft so user edits survive. */
    if (err instanceof Error && err.message === 'conflict') {
      try {
        const remote = await api.getProfile()
        const cur = get()
        const server = domainToWallet(remote, {
          licensePhotoLocal: keepInflightPhoto(cur.profile.licensePhotoLocal),
          carteGrisePhotoLocal: keepInflightPhoto(cur.profile.carteGrisePhotoLocal),
          attestationPhotoLocal: keepInflightPhoto(cur.profile.attestationPhotoLocal),
          avatarPhotoLocal: keepInflightPhoto(cur.profile.avatarPhotoLocal),
          assistanceNumber: cur.serverProfile.assistanceNumber,
          brokerPhone: cur.serverProfile.brokerPhone,
          phoneVerified: cur.serverProfile.phoneVerified,
          // Not in the domain profile — without this a 409 bounced users to /onboarding.
          onboarded: cur.serverProfile.onboarded,
        })
        applyMerged(set, server, cur.draft)
      } catch {
        /* offline — draft remains */
        return
      }
      // Draft still holds the edit — resend once on the fresh stamp so it reaches the server.
      if (retryOnConflict) await flushPersistDraft(get, set, false, opts)
      return
    }
    /* server sync best-effort — memory wallet + draft remain */
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
  opts?: { brokerAutoAssignAck?: boolean },
): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const waiters = persistWaiters
  persistWaiters = []
  await persistChain
  await flushPersistDraft(get, set, true, opts)
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
      applyMerged(useProfileStore.setState, next, {})
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
  serverProfile: emptyWallet,
  draft: {},
  saving: false,
  error: null,
  remoteHydrated: false,
  walletEditing: false,
  setProfile: (patch) => {
    const draft = { ...get().draft, ...patch }
    for (const key of Object.keys(patch) as Array<keyof Wallet>) {
      dirtyRevision[key] = nextRevision++
    }
    applyMerged(set, get().serverProfile, draft)
    if ('firstName' in patch || 'lastName' in patch) {
      const merged = mergeView(get().serverProfile, draft)
      const label = `${merged.firstName.trim()} ${merged.lastName.trim()}`.trim()
      if (label) {
        void import('@/store/session.ts').then(({ useSessionStore }) => {
          useSessionStore.getState().patchUser({ displayName: label })
        })
      }
    }
  },
  setWalletEditing: (editing) => set({ walletEditing: editing }),
  ensureDeviceWallet: () => {
    const current = get().profile
    if (!needsDeviceWallet(current) && !isLegacySharedWallet(current)) return
    const base = isLegacySharedWallet(current)
      ? migrateDeviceWallet(current)
      : createDeviceWallet()
    const draftFields = Object.fromEntries(
      DRAFT_KEYS.map((key) => [key, current[key]]),
    ) as Pick<Wallet, (typeof DRAFT_KEYS)[number]>
    const next = {
      ...base,
      ...draftFields,
      onboarded: needsDeviceWallet(current) ? false : current.onboarded,
    }
    dirtyRevision = {}
    applyMerged(set, next, {})
  },
  persistDraft: () => schedulePersist(get, set),
  persistDraftNow: () => flushPersistNow(get, set),
  ackBrokerAutoAssign: () => flushPersistNow(get, set, { brokerAutoAssignAck: true }),
  pullRemoteProfile: async () => {
    // Don't clobber in-progress edits.
    if (get().walletEditing) return
    // Flush pending debounce before GET — close-after-finish used to skip pull
    // while timer lived, then land an incomplete ack + empty draft and snap back.
    if (persistTimer) {
      await flushPersistNow(get, set)
    } else {
      await persistChain
    }
    if (get().walletEditing) return
    const cur = get()
    if (!cur.profile.motoristId.trim()) return
    try {
      const remote = await api.getProfile()
      // Server snapshot only — draft overlay never deleted by a pull.
      let server = domainToWallet(remote, {
        licensePhotoLocal: keepInflightPhoto(cur.profile.licensePhotoLocal),
        carteGrisePhotoLocal: keepInflightPhoto(cur.profile.carteGrisePhotoLocal),
        attestationPhotoLocal: keepInflightPhoto(cur.profile.attestationPhotoLocal),
        avatarPhotoLocal: keepInflightPhoto(cur.profile.avatarPhotoLocal),
      })
      let onboarded = cur.profile.onboarded
      try {
        const { useSessionStore } = await import('@/store/session.ts')
        const user = useSessionStore.getState().user
        if (user?.role === 'motorist') {
          onboarded = Boolean(user.onboarded) || cur.profile.onboarded
        }
      } catch {
        /* circular import edge — keep cur */
      }
      server = {
        ...server,
        onboarded,
        phoneVerified: Boolean(server.phone.trim()) || cur.profile.phoneVerified,
      }

      const fillPhoto = async (
        kind: 'license' | 'carteGrise' | 'attestation' | 'avatar',
        path: string,
        local: string,
        key:
          | 'licensePhotoLocal'
          | 'carteGrisePhotoLocal'
          | 'attestationPhotoLocal'
          | 'avatarPhotoLocal',
      ) => {
        if (!path || local.startsWith('data:')) return
        if (/^https?:\/\//i.test(local)) return
        try {
          const { url } = await api.profileDocUrl(kind)
          server = { ...server, [key]: url }
        } catch {
          /* ignore */
        }
      }
      await fillPhoto(
        'license',
        server.licensePhotoPath,
        server.licensePhotoLocal,
        'licensePhotoLocal',
      )
      await fillPhoto(
        'carteGrise',
        server.carteGrisePhotoPath,
        server.carteGrisePhotoLocal,
        'carteGrisePhotoLocal',
      )
      await fillPhoto(
        'attestation',
        server.attestationPhotoPath,
        server.attestationPhotoLocal,
        'attestationPhotoLocal',
      )
      await fillPhoto(
        'avatar',
        server.avatarPhotoPath,
        server.avatarPhotoLocal,
        'avatarPhotoLocal',
      )
      // Stale/incomplete GET must not blank fields the user just finished.
      // Re-dirt those keys so the next PUT retries until the server sticks.
      const latest = get()
      const protectedDraft = { ...latest.draft }
      let redacted = false
      for (const key of PORTEFEUILLE_PROGRESS_FIELDS) {
        if (key in protectedDraft) continue
        if (stringFilled(latest.profile[key]) && !stringFilled(server[key])) {
          protectedDraft[key] = latest.profile[key] as never
          dirtyRevision[key] = nextRevision++
          redacted = true
        }
      }
      applyMerged(set, server, protectedDraft, { remoteHydrated: true })
      if (redacted) void schedulePersist(get, set)
    } catch {
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
      await api.saveProfile(walletToDomain(next))
      const session = await api.completeProfile()
      dirtyRevision = {}
      applyMerged(set, next, {}, { saving: false })
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
  reset: () => {
    dirtyRevision = {}
    applyMerged(set, createDeviceWallet(), {}, {
      error: null,
      remoteHydrated: false,
      walletEditing: false,
    })
  },
}))

if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __labasProfile?: typeof useProfileStore }).__labasProfile =
    useProfileStore
}
