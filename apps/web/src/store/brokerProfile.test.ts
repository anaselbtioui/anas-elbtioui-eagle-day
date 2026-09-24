import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@labas/domain/auth.ts'
import type { BrokerProfile } from '@/services/http-contract.ts'
import {
  brokerDraftFromApi,
  countBrokerDraftChanges,
  emptyBrokerDraft,
  useBrokerProfileStore,
} from '@/store/brokerProfile.ts'

const getBrokerProfile = vi.fn()
const saveBrokerProfile = vi.fn()
const uploadBrokerAvatar = vi.fn()
const brokerAvatarUrl = vi.fn()
const patchUser = vi.fn()

vi.mock('@/services/api.ts', () => ({
  api: {
    getBrokerProfile: (...args: unknown[]) => getBrokerProfile(...args),
    saveBrokerProfile: (...args: unknown[]) => saveBrokerProfile(...args),
    uploadBrokerAvatar: (...args: unknown[]) => uploadBrokerAvatar(...args),
    brokerAvatarUrl: (...args: unknown[]) => brokerAvatarUrl(...args),
  },
}))

vi.mock('@/store/session.ts', () => ({
  useSessionStore: {
    getState: () => ({
      patchUser: (...args: unknown[]) => patchUser(...args),
    }),
  },
}))

function remoteProfile(overrides?: Partial<BrokerProfile>): BrokerProfile {
  return {
    firstName: 'Salma',
    lastName: 'Benali',
    phone: '+212612345678',
    email: 'salma@labas.test',
    displayName: 'Salma Benali',
    avatarPhotoPath: null,
    ...overrides,
  }
}

const sessionUser: AuthUser = {
  id: 'u-broker',
  email: 'salma@labas.test',
  role: 'broker',
  displayName: 'Salma Benali',
  onboarded: true,
  motoristId: null,
  brokerId: 'B-1',
  vehicleId: null,
  insurerId: null,
  policyId: null,
}

describe('brokerProfile helpers', () => {
  it('counts identity and avatar changes', () => {
    const baseline = brokerDraftFromApi(remoteProfile())
    const draft = { ...baseline, firstName: 'Sara', phone: '+212600000000' }
    expect(countBrokerDraftChanges(draft, baseline)).toBe(2)
    expect(countBrokerDraftChanges({ ...draft, avatarPhotoLocal: 'data:image/png;base64,aa' }, baseline)).toBe(
      3,
    )
  })
})

describe('useBrokerProfileStore', () => {
  beforeEach(() => {
    getBrokerProfile.mockReset()
    saveBrokerProfile.mockReset()
    uploadBrokerAvatar.mockReset()
    brokerAvatarUrl.mockReset()
    patchUser.mockReset()
    useBrokerProfileStore.setState({
      profile: emptyBrokerDraft(),
      remoteHydrated: false,
      saving: false,
      error: null,
    })
  })

  it('pullRemote hydrates draft', async () => {
    getBrokerProfile.mockResolvedValue(remoteProfile({ avatarPhotoPath: 'brokers/B-1/avatar.jpg' }))
    brokerAvatarUrl.mockResolvedValue({
      url: 'https://signed.example/avatar',
      path: 'brokers/B-1/avatar.jpg',
    })
    await useBrokerProfileStore.getState().pullRemote()
    const { profile, remoteHydrated } = useBrokerProfileStore.getState()
    expect(remoteHydrated).toBe(true)
    expect(profile.firstName).toBe('Salma')
    expect(profile.avatarPhotoLocal).toBe('https://signed.example/avatar')
  })

  it('persistDraft clears dirty baseline fields and patches session name', async () => {
    useBrokerProfileStore.setState({
      profile: {
        ...brokerDraftFromApi(remoteProfile()),
        firstName: 'Sara',
        lastName: 'Amrani',
        phone: '+212611111111',
      },
      remoteHydrated: true,
    })
    const saved = remoteProfile({
      firstName: 'Sara',
      lastName: 'Amrani',
      phone: '+212611111111',
      displayName: 'Sara Amrani',
    })
    saveBrokerProfile.mockResolvedValue({
      ...saved,
      user: { ...sessionUser, displayName: 'Sara Amrani' },
    })

    const next = await useBrokerProfileStore.getState().persistDraft()
    expect(saveBrokerProfile).toHaveBeenCalledWith({
      firstName: 'Sara',
      lastName: 'Amrani',
      phone: '+212611111111',
      avatarPhotoPath: null,
    })
    expect(next.firstName).toBe('Sara')
    expect(next.displayName).toBe('Sara Amrani')
    expect(useBrokerProfileStore.getState().saving).toBe(false)
    expect(patchUser).toHaveBeenCalledWith({ ...sessionUser, displayName: 'Sara Amrani' })
    expect(countBrokerDraftChanges(next, next)).toBe(0)
  })
})
