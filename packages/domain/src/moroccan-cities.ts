/** Curated Moroccan cities (French UI labels) + rough centroids for geo snap. */

export type MoroccanCity = {
  name: string
  lat: number
  lng: number
}

/** Prefectures / major communes commonly used as residence city. */
export const MOROCCAN_CITIES: readonly MoroccanCity[] = [
  { name: 'Agadir', lat: 30.4278, lng: -9.5981 },
  { name: 'Al Hoceima', lat: 35.2517, lng: -3.9372 },
  { name: 'Beni Mellal', lat: 32.3373, lng: -6.3498 },
  { name: 'Berkane', lat: 34.92, lng: -2.32 },
  { name: 'Berrechid', lat: 33.2653, lng: -7.5875 },
  { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  { name: 'Dakhla', lat: 23.7147, lng: -15.936 },
  { name: 'El Jadida', lat: 33.2316, lng: -8.5007 },
  { name: 'Errachidia', lat: 31.9314, lng: -4.4269 },
  { name: 'Essaouira', lat: 31.5085, lng: -9.7595 },
  { name: 'Fès', lat: 34.0181, lng: -5.0078 },
  { name: 'Fquih Ben Salah', lat: 32.501, lng: -6.690 },
  { name: 'Guelmim', lat: 28.987, lng: -10.0574 },
  { name: 'Ifrane', lat: 33.5228, lng: -5.1103 },
  { name: 'Kénitra', lat: 34.261, lng: -6.5802 },
  { name: 'Khemisset', lat: 33.824, lng: -6.066 },
  { name: 'Khouribga', lat: 32.8811, lng: -6.9063 },
  { name: 'Ksar El Kebir', lat: 34.9989, lng: -5.9042 },
  { name: 'Laâyoune', lat: 27.1536, lng: -13.2033 },
  { name: 'Larache', lat: 35.1932, lng: -6.1563 },
  { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  { name: 'Martil', lat: 35.6167, lng: -5.275 },
  { name: 'Meknès', lat: 33.8935, lng: -5.5473 },
  { name: 'Midelt', lat: 32.6852, lng: -4.734 },
  { name: 'Mohammedia', lat: 33.686, lng: -7.383 },
  { name: 'Nador', lat: 35.1688, lng: -2.933 },
  { name: 'Ouarzazate', lat: 30.9335, lng: -6.937 },
  { name: 'Ouezzane', lat: 34.797, lng: -5.582 },
  { name: 'Oujda', lat: 34.6814, lng: -1.9086 },
  { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
  { name: 'Safi', lat: 32.2994, lng: -9.2372 },
  { name: 'Salé', lat: 34.0531, lng: -6.7985 },
  { name: 'Settat', lat: 33.001, lng: -7.616 },
  { name: 'Sidi Bennour', lat: 32.649, lng: -8.427 },
  { name: 'Sidi Ifni', lat: 29.3797, lng: -10.1728 },
  { name: 'Sidi Kacem', lat: 34.221, lng: -5.712 },
  { name: 'Sidi Slimane', lat: 34.265, lng: -5.925 },
  { name: 'Skhirat', lat: 33.852, lng: -7.031 },
  { name: 'Tanger', lat: 35.7595, lng: -5.834 },
  { name: 'Tan-Tan', lat: 28.438, lng: -11.103 },
  { name: 'Taourirt', lat: 34.407, lng: -2.897 },
  { name: 'Taza', lat: 34.213, lng: -4.01 },
  { name: 'Témara', lat: 33.928, lng: -6.906 },
  { name: 'Tétouan', lat: 35.5889, lng: -5.3626 },
  { name: 'Tiznit', lat: 29.697, lng: -9.731 },
  { name: 'Youssoufia', lat: 32.246, lng: -8.529 },
] as const

const CITY_NAMES = new Set(MOROCCAN_CITIES.map((c) => c.name.toLowerCase()))

export function isMoroccanCity(value: string): boolean {
  return CITY_NAMES.has(value.trim().toLowerCase())
}

/** Resolve list entry by case-insensitive name; returns canonical French label. */
export function canonicalCityName(value: string): string | null {
  const key = value.trim().toLowerCase()
  const hit = MOROCCAN_CITIES.find((c) => c.name.toLowerCase() === key)
  return hit?.name ?? null
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** Nearest curated city to a GPS point (km). */
export function findNearestCity(lat: number, lng: number): MoroccanCity {
  let best = MOROCCAN_CITIES[0]!
  let bestKm = Number.POSITIVE_INFINITY
  for (const city of MOROCCAN_CITIES) {
    const km = haversineKm(lat, lng, city.lat, city.lng)
    if (km < bestKm) {
      bestKm = km
      best = city
    }
  }
  return best
}

export function filterCities(query: string, limit = 12): MoroccanCity[] {
  const q = query.trim().toLowerCase()
  if (!q) return MOROCCAN_CITIES.slice(0, limit)
  return MOROCCAN_CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, limit)
}
