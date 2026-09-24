import { describe, expect, it } from 'vitest'
import { walletNudgeKind } from '@/features/home/WalletNudgeDrawer'
import { emptyWallet, type Wallet } from '@/services/wallet.ts'

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

describe('walletNudgeKind', () => {
  it('returns brokerAssigned when auto-link pending', () => {
    expect(
      walletNudgeKind({
        ...full,
        brokerAutoAssignedAt: '2026-09-24T12:00:00.000Z',
        brokerAutoAssignPending: true,
      }),
    ).toBe('brokerAssigned')
  })

  it('returns complete when full and not pending', () => {
    expect(walletNudgeKind(full)).toBe('complete')
  })
})
