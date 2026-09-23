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
const saveProfile = vi.fn().mockResolvedValue(undefined)
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
    }),
  },
}))

function remoteProfile(overrides?: {
  phone?: string | null
  brokerId?: string
  policy?: string | null
}): Profile {
  return {
    motorist: {
      id: 'M-remote',
      name: 'Nadia El Mansouri',
      phone: overrides?.phone ?? '+212612345678',
      alsoTellEmployerIfCommute: false,
      cin: 'AB123456',
      city: 'Casablanca',
      licenseNumber: 'P-1',
      licensePhotoPath: null,
      carteGrisePhotoPath: null,
      attestationPhotoPath: null,
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
      attestationValidUntil: '2099-06-01',
    },
  }
}

describe('pullRemoteProfile remote-wins', () => {
  beforeEach(() => {
    resetProfilePersistForTests()
    getProfile.mockReset()
    saveProfile.mockClear()
    localStorage.clear()
    useProfileStore.setState({
      profile: {
        ...emptyWallet,
        motoristId: 'M-remote',
        phone: 'stale-local',
        brokerId: 'B-local-stale',
        broker: 'Local Broker',
        firstName: 'Local',
        lastName: 'Only',
        onboarded: false,
      },
      error: null,
      saving: false,
      remoteHydrated: false,
    })
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

  it('overwrites nonempty local fields with server values', async () => {
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

  it('keeps in-flight photos and client-only wallet fields', async () => {
    const dataUrl = 'data:image/png;base64,abc'
    useProfileStore.setState({
      profile: {
        ...useProfileStore.getState().profile,
        licensePhotoLocal: dataUrl,
        assistanceNumber: '0800123456',
        brokerPhone: '+212612000000',
        onboardingStep: 4,
      },
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

    useProfileStore.setState({
      profile: { ...emptyWallet, motoristId: 'M-remote' },
      error: null,
      saving: false,
    })
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
    useProfileStore.setState({
      profile: { ...emptyWallet, motoristId: 'M-migrate' },
      error: null,
      saving: false,
    })
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
