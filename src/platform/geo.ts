export interface GeoPoint {
  lat: number
  lng: number
  accuracy?: number
}

function isNative(): boolean {
  return Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  )
}

async function loadOptional(specifier: string): Promise<unknown> {
  try {
    return await import(/* @vite-ignore */ specifier)
  } catch {
    return null
  }
}

export async function getCurrentPosition(): Promise<GeoPoint | null> {
  if (isNative()) {
    const mod = (await loadOptional('@capacitor/geolocation')) as {
      Geolocation?: {
        getCurrentPosition: (opts: Record<string, unknown>) => Promise<{
          coords: { latitude: number; longitude: number; accuracy: number }
        }>
      }
    } | null
    if (mod?.Geolocation) {
      const pos = await mod.Geolocation.getCurrentPosition({ enableHighAccuracy: true })
      return {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }
    }
  }

  if (!navigator.geolocation) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  })
}
