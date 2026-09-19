import { describe, expect, it } from 'vitest'
import {
  createDeviceWallet,
  emptyWallet,
  isLegacySharedWallet,
  LEGACY_SHARED_MOTORIST_ID,
  migrateDeviceWallet,
} from './wallet.ts'

describe('per-device id migration', () => {
  it('detects shared M-1 wallet', () => {
    expect(isLegacySharedWallet({ ...emptyWallet, motoristId: LEGACY_SHARED_MOTORIST_ID })).toBe(
      true,
    )
    expect(isLegacySharedWallet(createDeviceWallet())).toBe(false)
  })

  it('replaces M-1 with device ids and keeps typed fields', () => {
    const legacy = {
      ...emptyWallet,
      motoristId: 'M-1',
      vehicleId: 'V-1',
      insurerId: 'I-1',
      brokerId: 'B-1',
      policyId: 'P-1',
      name: 'Nadia El Mansouri',
      city: 'Casablanca',
      policy: 'MA-AUTO-24018',
      onboarded: true,
    }
    const next = migrateDeviceWallet(legacy)
    expect(next.motoristId).not.toBe('M-1')
    expect(next.motoristId.startsWith('M-')).toBe(true)
    expect(next.vehicleId.startsWith('V-')).toBe(true)
    expect(next.name).toBe('Nadia El Mansouri')
    expect(next.city).toBe('Casablanca')
    expect(next.policy).toBe('MA-AUTO-24018')
    expect(next.onboarded).toBe(true)
  })

  it('leaves already-migrated wallets unchanged', () => {
    const device = createDeviceWallet()
    device.name = 'Karim'
    expect(migrateDeviceWallet(device)).toEqual(device)
  })
})
