import { beforeEach, describe, expect, it } from 'vitest'
import type { AuthUser } from '@/domain/auth.ts'
import { emptyWallet, walletRemainingPercent } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile.ts'
import { syncProfile } from '@/store/session.ts'

const motoristAuth = (displayName: string, onboarded = false): AuthUser => ({
  id: 'u-1',
  email: 'a@labas.test',
  role: 'motorist',
  displayName,
  onboarded,
  motoristId: 'M-test-1',
  vehicleId: 'V-test-1',
  insurerId: 'I-test-1',
  brokerId: '',
  policyId: 'P-test-1',
})

describe('syncProfile', () => {
  beforeEach(() => {
    useProfileStore.setState({
      profile: emptyWallet,
      serverProfile: emptyWallet,
      draft: {},
      error: null,
      saving: false,
      remoteHydrated: false,
      walletEditing: false,
    })
  })

  it('splits auth displayName into firstName/lastName on signup', () => {
    syncProfile(motoristAuth('Fluid Hover'))
    const { firstName, lastName, motoristId } = useProfileStore.getState().profile
    expect(motoristId).toBe('M-test-1')
    expect(firstName).toBe('Fluid')
    expect(lastName).toBe('Hover')
  })

  it('counts signup names in portefeuille remaining %', () => {
    syncProfile(motoristAuth('Nadia El Mansouri'))
    // 11 progress fields; 2 names filled → 9/11 ≈ 82%
    expect(walletRemainingPercent(useProfileStore.getState().profile)).toBe(82)
  })

  it('keeps existing names on same-motorist refresh', () => {
    useProfileStore.setState({
      profile: {
        ...emptyWallet,
        motoristId: 'M-test-1',
        firstName: 'Karim',
        lastName: 'Alaoui',
        city: 'Rabat',
      },
      serverProfile: {
        ...emptyWallet,
        motoristId: 'M-test-1',
        firstName: 'Karim',
        lastName: 'Alaoui',
        city: 'Rabat',
      },
      draft: {},
    })
    syncProfile(motoristAuth('Other Name'))
    const p = useProfileStore.getState().profile
    expect(p.firstName).toBe('Karim')
    expect(p.lastName).toBe('Alaoui')
    expect(p.city).toBe('Rabat')
  })

  it('seeds empty names on same-motorist when wallet still blank', () => {
    useProfileStore.setState({
      profile: {
        ...emptyWallet,
        motoristId: 'M-test-1',
        brokerId: 'B-1',
      },
      serverProfile: {
        ...emptyWallet,
        motoristId: 'M-test-1',
        brokerId: 'B-1',
      },
      draft: {},
    })
    syncProfile(motoristAuth('Said Courtier'))
    const p = useProfileStore.getState().profile
    expect(p.firstName).toBe('Said')
    expect(p.lastName).toBe('Courtier')
    expect(p.brokerId).toBe('B-1')
  })

  it('keeps local onboarded when JWT still says false', () => {
    useProfileStore.setState({
      profile: {
        ...emptyWallet,
        motoristId: 'M-test-1',
        onboarded: true,
      },
      serverProfile: {
        ...emptyWallet,
        motoristId: 'M-test-1',
        onboarded: true,
      },
      draft: {},
    })
    syncProfile(motoristAuth('Nadia El Mansouri', false))
    expect(useProfileStore.getState().profile.onboarded).toBe(true)
  })
})
