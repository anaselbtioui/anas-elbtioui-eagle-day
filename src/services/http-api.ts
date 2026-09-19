import { getAuthToken } from './auth-token.ts'

function bearerToken(): string | null {
  const memory = getAuthToken()
  if (memory) return memory
  try {
    const raw = localStorage.getItem('labas-session-v3')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } }
    return parsed.state?.token ?? null
  } catch {
    return null
  }
}
import type { AuthSession, AuthUser } from '@/domain/auth.ts'
import type { Dossier, EvidencePack, Profile } from '@/domain/types.ts'
import type { DeskBundle } from '@/domain/desk.ts'
import type {
  BrokerClient,
  CreatePackInput,
  DeclarationBundle,
  EvidencePieces,
  IncidentFile,
  LabasHttpApi,
  PackPatch,
  RegisteredBroker,
  SessionSnapshot,
} from './http-contract.ts'

const base = () => import.meta.env.VITE_API_URL ?? ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(bearerToken() ? { Authorization: `Bearer ${bearerToken()}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: T & { error?: string }
  try {
    body = JSON.parse(text) as T & { error?: string }
  } catch {
    throw new Error(text.slice(0, 80) || `http_${res.status}`)
  }
  if (!res.ok) {
    throw new Error(body.error ?? `http_${res.status}`)
  }
  return body
}

export const httpApi: LabasHttpApi = {
  signUp: (input) =>
    req<AuthSession>('/api/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
  signIn: (input) =>
    req<AuthSession>('/api/auth/signin', { method: 'POST', body: JSON.stringify(input) }),
  refresh: () => req<AuthSession>('/api/auth/refresh', { method: 'POST', body: '{}' }),
  me: () => req<AuthUser>('/api/auth/me'),
  getSession: (motoristId) => {
    const q = motoristId ? `?motoristId=${encodeURIComponent(motoristId)}` : ''
    return req<SessionSnapshot>(`/api/session${q}`)
  },
  getProfile: (motoristId) => {
    const q = motoristId ? `?motoristId=${encodeURIComponent(motoristId)}` : ''
    return req<Profile>(`/api/profile${q}`)
  },
  saveProfile: (profile) =>
    req<Profile>('/api/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  loadDemoProfile: () => req<Profile>('/api/profile/demo', { method: 'POST' }),
  listContacts: (assistanceOnContract) =>
    req(`/api/contacts?assistanceOnContract=${assistanceOnContract}`),
  listPacks: (motoristId) => {
    const q = motoristId ? `?motoristId=${encodeURIComponent(motoristId)}` : ''
    return req<EvidencePack[]>(`/api/packs${q}`)
  },
  createPack: (input?: CreatePackInput) =>
    req('/api/packs', { method: 'POST', body: JSON.stringify(input ?? {}) }),
  getPack: (incidentId) => req(`/api/packs/${incidentId}`),
  savePack: (pack) =>
    req(`/api/packs/${pack.incident.id}`, {
      method: 'PUT',
      body: JSON.stringify(pack),
    }),
  patchPack: (incidentId, patch: PackPatch) =>
    req(`/api/packs/${incidentId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  addPieces: (incidentId, pieces: EvidencePieces) =>
    req(`/api/packs/${incidentId}/pieces`, {
      method: 'POST',
      body: JSON.stringify(pieces),
    }),
  getFile: (incidentId) => req<IncidentFile>(`/api/files/${incidentId}`),
  saveDeclarationDraft: (incidentId, draft) =>
    req(`/api/declarations/${incidentId}`, {
      method: 'PUT',
      body: JSON.stringify(draft),
    }),
  submitDeclaration: (incidentId) =>
    req<DeclarationBundle>(`/api/declarations/${incidentId}/submit`, { method: 'POST' }),
  getDossier: (declarationId) => req(`/api/dossiers/${declarationId}`),
  getDossierByIncident: (incidentId) =>
    req<Dossier>(`/api/dossiers?incidentId=${encodeURIComponent(incidentId)}`),
  listBrokerQueue: () => req<DeskBundle[]>('/api/broker/queue'),
  listBrokerClients: () => req<BrokerClient[]>('/api/broker/clients'),
  listRegisteredBrokers: () => req<RegisteredBroker[]>('/api/brokers'),
  getBrokerDossier: (dossierId) => req<DeskBundle>(`/api/broker/dossiers/${dossierId}`),
  requestBrokerPiece: (dossierId, piece, note) =>
    req(`/api/broker/dossiers/${dossierId}/requests`, {
      method: 'POST',
      body: JSON.stringify({ piece, note }),
    }),
  createBrokerDraft: (dossierId, intent, pieceLabel) =>
    req(`/api/broker/dossiers/${dossierId}/drafts`, {
      method: 'POST',
      body: JSON.stringify({ intent, pieceLabel }),
    }),
  setBrokerDraftApproved: (dossierId, draftId, humanApproved) =>
    req(`/api/broker/dossiers/${dossierId}/drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify({ humanApproved }),
    }),
  setBrokerDraftBody: (dossierId, draftId, body) =>
    req(`/api/broker/dossiers/${dossierId}/drafts/${draftId}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),
  setBrokerOwner: (dossierId, owner) =>
    req(`/api/broker/dossiers/${dossierId}/owner`, {
      method: 'POST',
      body: JSON.stringify({ owner }),
    }),
  approveBrokerDraft: (dossierId, draftId) =>
    req(`/api/broker/dossiers/${dossierId}/drafts/${draftId}/approve`, { method: 'POST' }),
  toggleBrokerTask: (dossierId, taskId) =>
    req(`/api/broker/dossiers/${dossierId}/tasks/${taskId}/toggle`, { method: 'POST' }),
  handoffBrokerDossier: (dossierId) =>
    req(`/api/broker/dossiers/${dossierId}/handoff`, { method: 'POST' }),
  reset: async () => {
    await req('/api/reset', { method: 'POST' })
  },
  getImportMode: () => req<{ mode: 'live' | 'fixture' }>('/api/broker/import/mode'),
  startImportSession: (input) =>
    req('/api/broker/import/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getImportSession: (sessionId) => req(`/api/broker/import/sessions/${sessionId}`),
  resumeImportSession: (sessionId, action) =>
    req(`/api/broker/import/sessions/${sessionId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),
  confirmImportSession: (sessionId, resolutions) =>
    req(`/api/broker/import/sessions/${sessionId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ resolutions }),
    }),
  cancelImportSession: (sessionId) =>
    req(`/api/broker/import/sessions/${sessionId}/cancel`, { method: 'POST' }),
}
