import { randomUUID } from 'node:crypto'
import type {
  ClassifyResult,
  ExtractedImport,
  FieldResolution,
  ImportOutcome,
  ImportSource,
  MappingRow,
} from '../../src/domain/browser-import.ts'
import type { BrowserHandle } from './tools.ts'

export type ImportStep = {
  at: string
  kind: 'info' | 'ok' | 'warn' | 'error' | 'human'
  message: string
}

export type HumanGate = {
  reason: string
  reasonCode: 'otp' | 'captcha' | 'password' | 'consent' | 'other'
} | null

export type SessionStatus =
  | 'running'
  | 'human_gate'
  | 'await_confirm'
  | 'merged'
  | 'interrupted'
  | 'cancelled'

export type ImportSession = {
  id: string
  source: ImportSource
  mode: 'live' | 'fixture'
  fixtureOutcome: ImportOutcome
  status: SessionStatus
  steps: ImportStep[]
  humanGate: HumanGate
  extracted: ExtractedImport | null
  classification: ClassifyResult | null
  mappingRows: MappingRow[]
  browser: BrowserHandle | null
  errorBudget: number
  mergedDossierId: string | null
  owner: string
  createdAt: string
  listeners: Set<(session: ImportSession) => void>
  resumeWaiters: Array<(action: 'continue' | 'cancel') => void>
}

const sessions = new Map<string, ImportSession>()

export function createSession(input: {
  source: ImportSource
  mode: 'live' | 'fixture'
  fixtureOutcome: ImportOutcome
  owner: string
}): ImportSession {
  const session: ImportSession = {
    id: randomUUID(),
    source: input.source,
    mode: input.mode,
    fixtureOutcome: input.fixtureOutcome,
    status: 'running',
    steps: [],
    humanGate: null,
    extracted: null,
    classification: null,
    mappingRows: [],
    browser: null,
    errorBudget: 6,
    mergedDossierId: null,
    owner: input.owner,
    createdAt: new Date().toISOString(),
    listeners: new Set(),
    resumeWaiters: [],
  }
  sessions.set(session.id, session)
  return session
}

export function getSession(id: string): ImportSession | undefined {
  return sessions.get(id)
}

export function pushStep(
  session: ImportSession,
  kind: ImportStep['kind'],
  message: string,
): void {
  session.steps.push({ at: new Date().toISOString(), kind, message })
  notify(session)
}

export function notify(session: ImportSession): void {
  for (const listener of session.listeners) {
    try {
      listener(session)
    } catch {
      /* ignore */
    }
  }
}

export function publicSession(session: ImportSession) {
  return {
    id: session.id,
    source: session.source,
    mode: session.mode,
    status: session.status,
    steps: session.steps,
    humanGate: session.humanGate,
    extracted: session.extracted,
    classification: session.classification
      ? {
          outcome: session.classification.outcome,
          matchDossierId: session.classification.matchDossierId,
          reason: session.classification.reason,
        }
      : null,
    mappingRows: session.mappingRows,
    mergedDossierId: session.mergedDossierId,
    createdAt: session.createdAt,
  }
}

export function waitForResume(session: ImportSession): Promise<'continue' | 'cancel'> {
  return new Promise((resolve) => {
    session.resumeWaiters.push(resolve)
  })
}

export function signalResume(
  session: ImportSession,
  action: 'continue' | 'cancel',
): boolean {
  const waiters = session.resumeWaiters.splice(0)
  if (waiters.length === 0) return false
  for (const w of waiters) w(action)
  return true
}

export type ConfirmBody = {
  resolutions?: FieldResolution[]
}
