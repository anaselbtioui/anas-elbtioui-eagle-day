import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfigured } from './supabase-store.ts'

export const EVIDENCE_BUCKET = 'evidence'

function client(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function storageConfigured(): boolean {
  return supabaseConfigured()
}

export type ParsedDataUrl = {
  mime: string
  bytes: Buffer
  ext: string
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
}

export function parseDataUrl(dataUrl: string): ParsedDataUrl {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl.trim())
  if (!m) throw new Error('invalid_data_url')
  const mime = m[1]!.toLowerCase()
  const ext = MIME_EXT[mime]
  if (!ext) throw new Error('unsupported_mime')
  return { mime, bytes: Buffer.from(m[2]!, 'base64'), ext }
}

export function evidenceObjectPath(
  incidentId: string,
  photoId: string,
  slot: string,
  ext: string,
): string {
  const safeIncident = incidentId.replace(/[^a-zA-Z0-9._-]/g, '_')
  const safePhoto = photoId.replace(/[^a-zA-Z0-9._:-]/g, '_').replace(/:/g, '-')
  const safeSlot = slot.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${safeIncident}/${safeSlot}/${safePhoto}.${ext}`
}

export function walletDocObjectPath(
  motoristId: string,
  kind: 'license' | 'carteGrise' | 'attestation' | 'avatar',
  ext: string,
): string {
  const safeMotorist = motoristId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `wallet/${safeMotorist}/${kind}.${ext}`
}

export async function uploadEvidenceObject(
  path: string,
  bytes: Buffer,
  mime: string,
): Promise<string> {
  if (!storageConfigured()) throw new Error('storage_unconfigured')
  const sb = client()
  const { error } = await sb.storage.from(EVIDENCE_BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new Error(`storage_upload: ${error.message}`)
  return path
}

export async function signedEvidenceUrl(
  path: string,
  expiresInSec = 60 * 60,
): Promise<string> {
  if (!storageConfigured()) throw new Error('storage_unconfigured')
  const sb = client()
  const { data, error } = await sb.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(path, expiresInSec)
  if (error || !data?.signedUrl) {
    throw new Error(`storage_signed_url: ${error?.message ?? 'missing'}`)
  }
  return data.signedUrl
}
