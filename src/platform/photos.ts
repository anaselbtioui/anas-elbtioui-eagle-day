import { get, set, del } from 'idb-keyval'

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
