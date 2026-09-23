import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deriveOnboardingPhase,
  onboardingGapCount,
  onboardingRemainingPercent,
  resumeStepId,
} from './onboarding-phase.ts'
import { emptyWallet, walletRemainingPercent, type Wallet } from './wallet.ts'

const full: Wallet = {
  ...emptyWallet,
  firstName: 'Nadia',
  lastName: 'El Mansouri',
  phone: '+212612345678',
  phoneVerified: true,
  cin: 'AB123456',
  city: 'Casablanca',
  plate: '12345-A-50',
  vehicle: 'Dacia',
  insurer: 'Sanlam',
  policy: 'MA-1',
  brokerId: 'B-1',
  broker: 'Said',
  licenseNumber: 'P-1',
  attestationValidUntil: '2099-01-01',
}

describe('deriveOnboardingPhase', () => {
  it('is gaps when essentials missing', () => {
    expect(deriveOnboardingPhase(emptyWallet)).toBe('gaps')
    expect(resumeStepId(emptyWallet)).toBe('otp')
  })

  it('is claimReady when claim fields filled but portefeuille incomplete', () => {
    const partial: Wallet = {
      ...full,
      licenseNumber: '',
      attestationValidUntil: '',
    }
    expect(deriveOnboardingPhase(partial)).toBe('claimReady')
    expect(onboardingGapCount(partial)).toBeGreaterThan(0)
  })

  it('treats empty optional policy as complete when other fields filled', () => {
    expect(deriveOnboardingPhase({ ...full, policy: '' })).toBe('complete')
    expect(onboardingRemainingPercent({ ...full, policy: '' })).toBe(0)
  })

  it('is complete when fully filled and attestation far out', () => {
    expect(deriveOnboardingPhase(full)).toBe('complete')
    expect(resumeStepId(full)).toBe('review')
  })

  it('is expired when attestation date is past', () => {
    expect(deriveOnboardingPhase({ ...full, attestationValidUntil: '2020-01-01' })).toBe(
      'expired',
    )
  })

  it('same wallet → same remaining % (cross-session parity)', () => {
    const a = { ...full, policy: '' }
    const b = { ...full, policy: '' }
    expect(onboardingRemainingPercent(a)).toBe(onboardingRemainingPercent(b))
    expect(walletRemainingPercent(a)).toBe(walletRemainingPercent(b))
    expect(onboardingGapCount(a)).toBe(onboardingGapCount(b))
  })
})
