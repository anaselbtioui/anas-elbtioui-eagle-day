import type { VehicleMake } from '@/domain/moroccan-vehicles.ts'

/** Pin release so CDN cache stays stable. */
const LOGO_CDN = 'https://cdn.jsdelivr.net/gh/vehiclespecs/brand-logos@v1.0.0'

/** Filename map for Moroccan parc makes → vehiclespecs/brand-logos. */
const MAKE_LOGO_FILE: Record<VehicleMake, string> = {
  Audi: 'audi-logo.svg',
  BMW: 'bmw-logo.svg',
  Chevrolet: 'chevrolet-logo.png',
  Citroën: 'citroen-logo.svg',
  Dacia: 'dacia-logo.svg',
  Fiat: 'fiat-logo.svg',
  Ford: 'ford-logo.png',
  Honda: 'honda-logo.png',
  Hyundai: 'hyundai-logo.svg',
  Kia: 'kia-logo.svg',
  'Mercedes-Benz': 'mercedes-benz-logo.svg',
  Nissan: 'nissan-logo.svg',
  Opel: 'opel-logo.svg',
  Peugeot: 'peugeot-logo.svg',
  Renault: 'renault-logo.svg',
  Seat: 'seat-logo.svg',
  Skoda: 'skoda-logo.svg',
  Suzuki: 'suzuki-logo.svg',
  Toyota: 'toyota-logo.svg',
  Volkswagen: 'volkswagen-logo.svg',
}

export function vehicleMakeLogoUrl(make: string): string | null {
  const file = MAKE_LOGO_FILE[make as VehicleMake]
  if (!file) return null
  return `${LOGO_CDN}/${file}`
}
