/** Vercel serverless stub — browser import agent is local-only (Playwright). */

export function resolveImportMode(): 'live' | 'fixture' {
  return 'fixture'
}

export function fixtureExtract() {
  return null
}

export const PORTAL_URLS = {} as Record<string, string>

export async function runImportGraph(): Promise<void> {
  throw new Error('import_agent_unavailable_on_vercel')
}

export function createSession(): never {
  throw new Error('import_agent_unavailable_on_vercel')
}

export function getSession(): undefined {
  return undefined
}

export function publicSession(): Record<string, never> {
  return {}
}

export function signalResume(): boolean {
  return false
}

export function pushStep(): void {}

export function notify(): void {}

export async function closeBrowser(): Promise<void> {}

export type ImportSession = never
export type ConfirmBody = { action?: string }
