import { getAuthToken, setAuthToken } from './auth-token.ts'
import type { ImportSessionPublic } from './http-contract.ts'

const base = () => import.meta.env.VITE_API_URL ?? ''

function bearerFromStorage(): string | null {
  const live = getAuthToken()
  if (live) return live
  try {
    const raw = localStorage.getItem('labas-session-v3')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { token?: string } }
    const token = parsed.state?.token
    if (typeof token === 'string' && token) {
      setAuthToken(token)
      return token
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Subscribe to import session SSE until terminal status. */
export function subscribeImportEvents(
  sessionId: string,
  onUpdate: (session: ImportSessionPublic) => void,
): () => void {
  const token = bearerFromStorage()
  const url = `${base()}/api/broker/import/sessions/${sessionId}/events`
  const controller = new AbortController()

  void (async () => {
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      })
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          try {
            const data = JSON.parse(line.slice(6)) as ImportSessionPublic
            onUpdate(data)
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        /* fall back: caller may poll */
      }
    }
  })()

  return () => controller.abort()
}
