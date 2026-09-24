import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '@/domain/types.ts'
import { emptyWallet, walletRemainingPercent } from '@/services/wallet.ts'
import {
  migrateLegacyProfileStorage,
  PROFILE_STORAGE_KEY,
  resetProfilePersistForTests,
  useProfileStore,
} from '@/store/profile.ts'

const getProfile = vi.fn()
const saveProfile = vi.fn().mockImplementation(async (p: Profile) => p)
const uploadProfileDoc = vi.fn()
const profileDocUrl = vi.fn()

vi.mock('@/services/api.ts', () => ({
  api: {
    getProfile: (...args: unknown[]) => getProfile(...args),
    saveProfile: (...args: unknown[]) => saveProfile(...args),
    uploadProfileDoc: (...args: unknown[]) => uploadProfileDoc(...args),
    profileDocUrl: (...args: unknown[]) => profileDocUrl(...args),
    completeProfile: vi.fn(),
  },
}))

vi.mock('@/store/session.ts', () => ({
  useSessionStore: {
    getState: () => ({
      user: {
        role: 'motorist',
        onboarded: true,
        motoristId: 'M-remote',
      },
      applyAuth: vi.fn(),
    }),
  },
}))

function remoteProfile(overrides?: {
  phone?: string | null
  brokerId?: string
  policy?: string | null
  attestationValidUntil?: string | null
}): Profile {
  return {
    motorist: {
      id: 'M-remote',
      name: 'Nadia El Mansouri',
      firstName: 'Nadia',
      lastName: 'El Mansouri',
      phone: overrides?.phone ?? '+212612345678',
      alsoTellEmployerIfCommute: false,
      cin: 'AB123456',
      city: 'Casablanca',
      licenseNumber: 'P-1',
      licensePhotoPath: null,
      carteGrisePhotoPath: null,
      attestationPhotoPath: null,
      assistanceNumber: null,
      brokerPhone: null,
      onboardingStep: 0,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    vehicle: {
      id: 'V-1',
      plate: '12345-A-50',
      makeModel: 'Dacia Logan',
    },
    insurer: {
      id: 'I-1',
      displayName: 'Sanlam',
    },
    broker: {
      id: overrides?.brokerId ?? 'B-remote',
      displayName: 'Said Courtier',
    },
    policy: {
      id: 'P-1',
      number: overrides?.policy ?? 'POL-99',
      insurerId: 'I-1',
      brokerId: overrides?.brokerId ?? 'B-remote',
      vehicleId: 'V-1',
      assistanceOnContract: 'unknown',
      attestationValidUntil: overrides?.attestationValidUntil ?? '2099-06-01',
    },
  }
}

function resetStore(partial?: Partial<ReturnType<typeof useProfileStore.getState>['profile']>) {
  const profile = {
    ...emptyWallet,
    motoristId: 'M-remote',
    phone: 'stale-local',
    brokerId: 'B-local-stale',
    broker: 'Local Broker',
    firstName: 'Local',
    lastName: 'Only',
    onboarded: false,
    ...partial,
  }
  useProfileStore.setState({
    profile,
    serverProfile: profile,
    draft: {},
    error: null,
    saving: false,
    remoteHydrated: false,
    walletEditing: false,
  })
}

describe('pullRemoteProfile remote-wins', () => {
  beforeEach(() => {
    resetProfilePersistForTests()
    getProfile.mockReset()
    saveProfile.mockClear()
    localStorage.clear()
    resetStore()
  })

  it('keeps pending field edits across a remote pull', async () => {
    getProfile.mockResolvedValue(remoteProfile({ policy: null, attestationValidUntil: null }))
    useProfileStore.getState().setProfile({ attestationValidUntil: '2099-06-01' })
    await useProfileStore.getState().pullRemoteProfile()
    expect(useProfileStore.getState().profile.attestationValidUntil).toBe('2099-06-01')
  })

  it('keeps edits typed during an in-flight PUT across the next pull', async () => {
    vi.useFakeTimers()
    try {
      saveProfile.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(remoteProfile({ attestationValidUntil: '2099-01-01' })), 50)
          }),
      )
      getProfile.mockResolvedValue(remoteProfile({ attestationValidUntil: '2099-01-01' }))

      useProfileStore.getState().setProfile({ attestationValidUntil: '2099-01-01' })
      const persistP = useProfileStore.getState().persistDraft()
      await vi.advanceTimersByTimeAsync(400)

      // Type while PUT in flight
      useProfileStore.getState().setProfile({ attestationValidUntil: '2099-12-31' })
      await vi.advanceTimersByTimeAsync(50)
      await persistP

      expect(useProfileStore.getState().profile.attestationValidUntil).toBe('2099-12-31')
      expect(useProfileStore.getState().draft.attestationValidUntil).toBe('2099-12-31')

      await useProfileStore.getState().pullRemoteProfile()
      expect(useProfileStore.getState().profile.attestationValidUntil).toBe('2099-12-31')
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips pull while walletEditing is true', async () => {
    getProfile.mockResolvedValue(remoteProfile())
    useProfileStore.setState({ walletEditing: true })
    await useProfileStore.getState().pullRemoteProfile()
    expect(getProfile).not.toHaveBeenCalled()
  })

  it('marks remoteHydrated after a successful pull', async () => {
    expect(useProfileStore.getState().remoteHydrated).toBe(false)
    getProfile.mockResolvedValue(remoteProfile())
    await useProfileStore.getState().pullRemoteProfile()
    expect(useProfileStore.getState().remoteHydrated).toBe(true)
  })

  it('marks remoteHydrated after a failed pull so auth seed can show', async () => {
    getProfile.mockRejectedValue(new Error('offline'))
    await useProfileStore.getState().pullRemoteProfile()
    expect(useProfileStore.getState().remoteHydrated).toBe(true)
  })

  it('overwrites nonempty local fields with server values when draft empty', async () => {
    getProfile.mockResolvedValue(remoteProfile())
    await useProfileStore.getState().pullRemoteProfile()
    const p = useProfileStore.getState().profile
    expect(p.phone).toBe('+212612345678')
    expect(p.brokerId).toBe('B-remote')
    expect(p.firstName).toBe('Nadia')
    expect(p.lastName).toBe('El Mansouri')
    expect(p.policy).toBe('POL-99')
    expect(p.onboarded).toBe(true)
    expect(p.phoneVerified).toBe(true)
  })

  it('keeps in-flight photos and client-only wallet fields via draft', async () => {
    const dataUrl = 'data:image/png;base64,abc'
    useProfileStore.getState().setProfile({
      licensePhotoLocal: dataUrl,
      assistanceNumber: '0800123456',
      brokerPhone: '+212612000000',
      onboardingStep: 4,
    })
    getProfile.mockResolvedValue(remoteProfile())
    await useProfileStore.getState().pullRemoteProfile()
    const p = useProfileStore.getState().profile
    expect(p.licensePhotoLocal).toBe(dataUrl)
    expect(p.assistanceNumber).toBe('0800123456')
    expect(p.brokerPhone).toBe('+212612000000')
    expect(p.onboardingStep).toBe(4)
  })

  it('skips pull while a draft persist is pending', async () => {
    vi.useFakeTimers()
    try {
      getProfile.mockResolvedValue(remoteProfile())
      useProfileStore.getState().setProfile({ firstName: 'Typing' })
      void useProfileStore.getState().persistDraft()
      await useProfileStore.getState().pullRemoteProfile()
      expect(getProfile).not.toHaveBeenCalled()
      expect(useProfileStore.getState().profile.firstName).toBe('Typing')
    } finally {
      vi.useRealTimers()
    }
  })

  it('two store resets from same remote yield same remaining %', async () => {
    getProfile.mockResolvedValue(remoteProfile({ policy: null }))
    await useProfileStore.getState().pullRemoteProfile()
    const pctA = walletRemainingPercent(useProfileStore.getState().profile)
    const gapsA = useProfileStore.getState().profile.policy

    resetStore({ motoristId: 'M-remote' })
    await useProfileStore.getState().pullRemoteProfile()
    const pctB = walletRemainingPercent(useProfileStore.getState().profile)
    expect(pctA).toBe(pctB)
    expect(useProfileStore.getState().profile.policy).toBe(gapsA)
  })
})

describe('migrateLegacyProfileStorage', () => {
  beforeEach(() => {
    localStorage.clear()
    saveProfile.mockClear()
    resetStore({ motoristId: 'M-migrate' })
  })

  it('pushes legacy blob then removes labas-profile-v2', async () => {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({
        state: {
          profile: {
            ...emptyWallet,
            motoristId: 'M-migrate',
            phone: '+212600000000',
            firstName: 'Legacy',
            lastName: 'User',
          },
        },
      }),
    )
    await migrateLegacyProfileStorage()
    expect(localStorage.getItem(PROFILE_STORAGE_KEY)).toBeNull()
    expect(useProfileStore.getState().profile.firstName).toBe('Legacy')
    expect(saveProfile).toHaveBeenCalled()
  })
})
