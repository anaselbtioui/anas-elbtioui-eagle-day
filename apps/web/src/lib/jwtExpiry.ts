/** JWT payload `exp` as ms since epoch, or null if missing / invalid. */
export function getJwtExpiryMs(accessToken: string): number | null {
  const parts = accessToken.split('.')
  if (parts.length !== 3) return null
  try {
    let b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const pad = (4 - (b64.length % 4)) % 4
    if (pad) b64 += '='.repeat(pad)
    const json = JSON.parse(atob(b64)) as { exp?: unknown }
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}
