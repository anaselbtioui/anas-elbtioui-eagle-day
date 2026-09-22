/**
 * Common passenger and light-utility models on the Moroccan parc.
 * Not a NARSA registry. Unknown cars stay free text via "Autre".
 */
export const MOROCCAN_VEHICLES = {
  Audi: ['A3', 'A4', 'Q3', 'Q5'],
  BMW: ['Série 1', 'Série 3', 'Série 5', 'X1', 'X3'],
  Chevrolet: ['Aveo', 'Spark'],
  Citroën: ['Berlingo', 'C3', 'C4', 'C-Elysée'],
  Dacia: ['Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Sandero', 'Spring'],
  Fiat: ['500', 'Doblo', 'Punto', 'Tipo'],
  Ford: ['Fiesta', 'Focus', 'Kuga', 'Ranger'],
  Honda: ['Civic', 'CR-V', 'Jazz'],
  Hyundai: ['Accent', 'Grand i10', 'i10', 'i20', 'Tucson'],
  Kia: ['Picanto', 'Rio', 'Sportage'],
  'Mercedes-Benz': ['Classe A', 'Classe C', 'Classe E', 'Sprinter', 'Vito'],
  Nissan: ['Juke', 'Micra', 'Qashqai'],
  Opel: ['Astra', 'Corsa', 'Crossland'],
  Peugeot: ['208', '301', '308', '2008', '3008', '5008', 'Partner'],
  Renault: ['Captur', 'Clio', 'Express', 'Kadjar', 'Kangoo', 'Mégane', 'Symbol'],
  Seat: ['Arona', 'Ibiza', 'Leon'],
  Skoda: ['Fabia', 'Octavia'],
  Suzuki: ['Celerio', 'Swift', 'Vitara'],
  Toyota: ['Corolla', 'Hilux', 'Land Cruiser', 'RAV4', 'Yaris'],
  Volkswagen: ['Caddy', 'Golf', 'Polo', 'Tiguan'],
} as const

export type VehicleMake = keyof typeof MOROCCAN_VEHICLES

export const VEHICLE_YEAR_MIN = 1998
export const VEHICLE_YEAR_MAX = 2026

export function vehicleMakes(): VehicleMake[] {
  return (Object.keys(MOROCCAN_VEHICLES) as VehicleMake[]).sort((a, b) =>
    a.localeCompare(b, 'fr'),
  )
}

export function vehicleModels(make: string): readonly string[] {
  if (!isVehicleMake(make)) return []
  return MOROCCAN_VEHICLES[make]
}

export function vehicleYears(): string[] {
  const years: string[] = []
  for (let year = VEHICLE_YEAR_MAX; year >= VEHICLE_YEAR_MIN; year -= 1) {
    years.push(String(year))
  }
  return years
}

export function isVehicleMake(value: string): value is VehicleMake {
  return Object.prototype.hasOwnProperty.call(MOROCCAN_VEHICLES, value)
}

export function formatVehicleLabel(make: string, model: string, year: string): string {
  return `${make} ${model} ${year}`
}

/** Parse a stored label. Returns null when the text is not in the local list. */
export function parseVehicleLabel(
  value: string,
): { make: VehicleMake; model: string; year: string } | null {
  const trimmed = value.trim()
  const match = trimmed.match(/^(.*)\s+(19\d{2}|20\d{2})$/)
  if (!match) return null
  const year = match[2]
  const yearNum = Number(year)
  if (yearNum < VEHICLE_YEAR_MIN || yearNum > VEHICLE_YEAR_MAX) return null
  const rest = match[1].trim()
  const makes = (Object.keys(MOROCCAN_VEHICLES) as VehicleMake[]).sort(
    (a, b) => b.length - a.length,
  )
  for (const make of makes) {
    if (rest !== make && !rest.startsWith(`${make} `)) continue
    const model = rest.slice(make.length).trim()
    if ((MOROCCAN_VEHICLES[make] as readonly string[]).includes(model)) {
      return { make, model, year }
    }
  }
  return null
}
