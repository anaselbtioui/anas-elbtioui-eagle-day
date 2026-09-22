import { describe, expect, it } from 'vitest'
import { formatVehicleLabel, parseVehicleLabel } from './moroccan-vehicles.ts'

describe('parseVehicleLabel', () => {
  it('round-trips a listed car', () => {
    const label = formatVehicleLabel('Dacia', 'Sandero', '2019')
    expect(parseVehicleLabel(label)).toEqual({ make: 'Dacia', model: 'Sandero', year: '2019' })
  })

  it('keeps a two-word make and a two-word model', () => {
    expect(parseVehicleLabel('Mercedes-Benz Classe C 2021')).toEqual({
      make: 'Mercedes-Benz',
      model: 'Classe C',
      year: '2021',
    })
    expect(parseVehicleLabel('Toyota Land Cruiser 2016')).toEqual({
      make: 'Toyota',
      model: 'Land Cruiser',
      year: '2016',
    })
  })

  it('returns null for free text', () => {
    expect(parseVehicleLabel('Dacia Sandero Stepway 2019')).toBeNull()
    expect(parseVehicleLabel('')).toBeNull()
  })
})
