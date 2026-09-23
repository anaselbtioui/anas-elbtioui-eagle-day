import { describe, expect, it } from 'vitest'
import {
  isMoroccanCin,
  isMoroccanPlate,
  isPersonName,
  normalizeCin,
  normalizePersonName,
  normalizePlate,
} from './ma-fields'
import {
  canonicalCityName,
  findNearestCity,
  isMoroccanCity,
} from './moroccan-cities'

describe('isPersonName', () => {
  it('accepts accented names', () => {
    expect(isPersonName('Fatima')).toBe(true)
    expect(isPersonName('El Mansouri')).toBe(true)
    expect(isPersonName("O'Neill")).toBe(true)
    expect(isPersonName('Jean-Pierre')).toBe(true)
  })

  it('rejects digits and empty', () => {
    expect(isPersonName('')).toBe(false)
    expect(isPersonName('Ana5')).toBe(false)
    expect(isPersonName('123')).toBe(false)
  })

  it('normalizes spaces', () => {
    expect(normalizePersonName('  Fatima   Zahra ')).toBe('Fatima Zahra')
  })
})

describe('isMoroccanCin', () => {
  it('accepts two letters then digits', () => {
    expect(isMoroccanCin('CD676343')).toBe(true)
    expect(isMoroccanCin('cd676343')).toBe(true)
    expect(normalizeCin('cd 676343')).toBe('CD676343')
  })

  it('accepts one letter prefix', () => {
    expect(isMoroccanCin('A12345')).toBe(true)
  })

  it('rejects letters after digits or too many letters', () => {
    expect(isMoroccanCin('C1D676343')).toBe(false)
    expect(isMoroccanCin('ABC123')).toBe(false)
    expect(isMoroccanCin('123456')).toBe(false)
    expect(isMoroccanCin('CD')).toBe(false)
  })
})

describe('isMoroccanPlate', () => {
  it('accepts classic format', () => {
    expect(isMoroccanPlate('12345-A-50')).toBe(true)
    expect(isMoroccanPlate('12345-a-16')).toBe(true)
    expect(normalizePlate('12345-a-16')).toBe('12345-A-16')
  })

  it('rejects junk', () => {
    expect(isMoroccanPlate('')).toBe(false)
    expect(isMoroccanPlate('ABC')).toBe(false)
    expect(isMoroccanPlate('12345A50')).toBe(false)
  })
})

describe('moroccan cities', () => {
  it('knows curated labels', () => {
    expect(isMoroccanCity('Casablanca')).toBe(true)
    expect(isMoroccanCity('Fès')).toBe(true)
    expect(isMoroccanCity('Nowhere')).toBe(false)
    expect(canonicalCityName('casablanca')).toBe('Casablanca')
  })

  it('snaps Casablanca coords to Casablanca', () => {
    expect(findNearestCity(33.57, -7.59).name).toBe('Casablanca')
  })
})
