import { describe, expect, it } from 'vitest'
import {
  createDeviceWallet,
  displayName,
  emptyWallet,
  isLegacySharedWallet,
  LEGACY_SHARED_MOTORIST_ID,
  migrateDeviceWallet,
  migrateWalletNames,
  walletClaimReady,
  walletRemainingPercent,
  type Wallet,
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
    const next = migrateDeviceWallet(legacy as Wallet & { name?: string })
    expect(next.motoristId).not.toBe('M-1')
    expect(next.motoristId.startsWith('M-')).toBe(true)
    expect(next.vehicleId.startsWith('V-')).toBe(true)
    expect(next.firstName).toBe('Nadia')
    expect(next.lastName).toBe('El Mansouri')
    expect(displayName(next)).toBe('Nadia El Mansouri')
    expect(next.city).toBe('Casablanca')
    expect(next.policy).toBe('MA-AUTO-24018')
    expect(next.onboarded).toBe(true)
  })

  it('leaves already-migrated wallets unchanged', () => {
    const device = createDeviceWallet()
    device.firstName = 'Karim'
    device.lastName = 'Alaoui'
    expect(migrateDeviceWallet(device)).toEqual(device)
  })
})

describe('migrateWalletNames', () => {
  it('splits legacy name', () => {
    const next = migrateWalletNames({
      ...emptyWallet,
      name: 'Fatima Zahra',
    } as Wallet & { name?: string })
    expect(next.firstName).toBe('Fatima')
    expect(next.lastName).toBe('Zahra')
  })
})

describe('walletClaimReady', () => {
  it('needs valid first and last name', () => {
    const base: Wallet = {
      ...emptyWallet,
      firstName: 'Nadia',
      lastName: 'El Mansouri',
      phone: '0612345678',
      phoneVerified: true,
      cin: 'AB123456',
      city: 'Casablanca',
      plate: '12345-A-50',
      vehicle: 'Dacia Logan',
      insurer: 'Sanlam Maroc',
      brokerId: 'B-1',
    }
    expect(walletClaimReady(base)).toBe(true)
    expect(walletClaimReady({ ...base, lastName: '' })).toBe(false)
    expect(walletClaimReady({ ...base, firstName: 'Nad1a' })).toBe(false)
  })
})

describe('walletRemainingPercent', () => {
  it('is 100 when empty', () => {
    expect(walletRemainingPercent(emptyWallet)).toBe(100)
  })

  it('drops as portefeuille fields fill', () => {
    const partial: Wallet = {
      ...emptyWallet,
      firstName: 'Nadia',
      lastName: 'El Mansouri',
      phone: '0612345678',
      phoneVerified: true,
      cin: 'AB123456',
      city: 'Casablanca',
      plate: '12345-A-50',
      vehicle: 'Dacia',
      insurer: 'Sanlam',
      policy: 'MA-1',
      brokerId: 'B-1',
      licenseNumber: 'P-1',
      attestationValidUntil: '2027-01-01',
    }
    expect(walletRemainingPercent(partial)).toBe(0)
  })

  it('counts missing progress fields', () => {
    const partial: Wallet = {
      ...emptyWallet,
      firstName: 'Nadia',
      lastName: 'El Mansouri',
      phone: '0612345678',
      phoneVerified: true,
    }
    const pct = walletRemainingPercent(partial)
    expect(pct).toBeGreaterThan(0)
    expect(pct).toBeLessThan(100)
  })

  it('ignores the provision insurer placeholder', () => {
    const partial: Wallet = {
      ...emptyWallet,
      firstName: 'Nadia',
      lastName: 'El Mansouri',
      insurer: 'Assureur',
    }
    expect(walletRemainingPercent(partial)).toBe(85)
  })
})
