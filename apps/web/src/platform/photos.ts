import { get, set, del } from 'idb-keyval'
import { api } from '@/services/api.ts'
import { isBrowserOnline, isNetworkFailure } from '@/services/offline-pack-queue.ts'

const key = (packId: string, slot: string) => `labas-photo:${packId}:${slot}`

export async function savePhotoBlob(packId: string, slot: string, dataUrl: string) {
  await set(key(packId, slot), dataUrl)
}

export async function loadPhotoBlob(packId: string, slot: string) {
  return (await get<string>(key(packId, slot))) ?? null
}

export async function removePhotoBlob(packId: string, slot: string) {
  await del(key(packId, slot))
}

/** Cache locally, then best-effort upload to Supabase Storage via API. */
export async function saveAndUploadPhoto(
  packId: string,
  slot: string,
  dataUrl: string,
  opts?: {
    domainSlot?: string
    zoneId?: string | null
    label?: string
  },
): Promise<{ uploaded: boolean; storagePath?: string | null }> {
  await savePhotoBlob(packId, slot, dataUrl)
  if (!isBrowserOnline()) return { uploaded: false }
  try {
    const { photo } = await api.uploadPhoto(packId, {
      slot: opts?.domainSlot ?? slot,
      dataUrl,
      zoneId: opts?.zoneId ?? null,
      label: opts?.label ?? slot,
      photoId: `${packId}:${slot}`,
      capturedAt: new Date().toISOString(),
    })
    return { uploaded: true, storagePath: photo.storagePath ?? null }
  } catch (e) {
    if (isNetworkFailure(e)) return { uploaded: false }
    console.warn('photo upload failed', e)
    return { uploaded: false }
  }
}
