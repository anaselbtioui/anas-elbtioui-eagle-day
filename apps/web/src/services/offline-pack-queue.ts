import type { EvidencePack } from '@/domain/types.ts'
import type { CreatePackInput, EvidencePieces, PackPatch } from '@/services/http-contract.ts'
import { api } from '@/services/api.ts'

const STORAGE_KEY = 'labas-offline-pack-queue-v1'

export type OfflinePackOp =
  | {
      id: string
      op: 'createPack'
      input: CreatePackInput
      clientIncidentId: string
    }
  | { id: string; op: 'savePack'; pack: EvidencePack }
  | { id: string; op: 'patchPack'; incidentId: string; patch: PackPatch }
  | { id: string; op: 'addPieces'; incidentId: string; pieces: EvidencePieces }

export function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /failed to fetch|networkerror|network request failed|load failed|offline/i.test(msg)
}

export function isBrowserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine
}

function readQueue(): OfflinePackOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as OfflinePackOp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeQueue(ops: OfflinePackOp[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops))
}

function newOpId(): string {
  return crypto.randomUUID()
}

/** Coalesce: keep createPack order; replace prior savePack/patch/addPieces for same incident. */
function enqueue(op: OfflinePackOp) {
  const queue = readQueue()
  const incidentId =
    op.op === 'createPack'
      ? op.clientIncidentId
      : op.op === 'savePack'
        ? op.pack.incident.id
        : op.incidentId

  const next =
    op.op === 'createPack'
      ? [...queue, op]
      : [
          ...queue.filter((existing) => {
            if (existing.op === 'createPack') return true
            if (existing.op === 'savePack') return existing.pack.incident.id !== incidentId
            return existing.incidentId !== incidentId || existing.op !== op.op
          }),
          op,
        ]

  writeQueue(next)
}

export function enqueueCreatePack(input: CreatePackInput, clientIncidentId: string) {
  enqueue({
    id: newOpId(),
    op: 'createPack',
    input,
    clientIncidentId,
  })
}

export function enqueueSavePack(pack: EvidencePack) {
  enqueue({ id: newOpId(), op: 'savePack', pack })
}

export function enqueuePatchPack(incidentId: string, patch: PackPatch) {
  enqueue({ id: newOpId(), op: 'patchPack', incidentId, patch })
}

export function enqueueAddPieces(incidentId: string, pieces: EvidencePieces) {
  enqueue({ id: newOpId(), op: 'addPieces', incidentId, pieces })
}

export function peekOfflinePackQueue(): OfflinePackOp[] {
  return readQueue()
}

/** True when offline queue still has create/save/patch/pieces for this incident id. */
export function offlineQueueHasIncident(incidentId: string): boolean {
  if (!incidentId.trim()) return false
  return readQueue().some((op) => {
    if (op.op === 'createPack') return op.clientIncidentId === incidentId
    if (op.op === 'savePack') return op.pack.incident.id === incidentId
    return op.incidentId === incidentId
  })
}

export function clearOfflinePackQueue() {
  localStorage.removeItem(STORAGE_KEY)
}

function remapIncidentId(ops: OfflinePackOp[], from: string, to: string): OfflinePackOp[] {
  return ops.map((op) => {
    if (op.op === 'createPack') {
      return op.clientIncidentId === from ? { ...op, clientIncidentId: to } : op
    }
    if (op.op === 'savePack') {
      if (op.pack.incident.id !== from) return op
      return {
        ...op,
        pack: {
          ...op.pack,
          incident: { ...op.pack.incident, id: to },
          evidence: { ...op.pack.evidence, incidentId: to },
        },
      }
    }
    if (op.incidentId !== from) return op
    return { ...op, incidentId: to }
  })
}

export type OfflineIdRemap = { from: string; to: string }

/**
 * Replay queued NOW pack writes in order. Stops on first non-network failure
 * so remaining ops stay queued. Returns remaps when createPack minted a new id.
 */
export async function flushOfflinePackQueue(): Promise<OfflineIdRemap[]> {
  if (!isBrowserOnline()) return []

  const remaps: OfflineIdRemap[] = []
  let queue = readQueue()

  while (queue.length > 0) {
    const [head, ...rest] = queue
    try {
      if (head.op === 'createPack') {
        const created = await api.createPack(head.input)
        const serverId = created.incident.id
        if (serverId !== head.clientIncidentId) {
          remaps.push({ from: head.clientIncidentId, to: serverId })
          queue = remapIncidentId(rest, head.clientIncidentId, serverId)
        } else {
          queue = rest
        }
      } else if (head.op === 'savePack') {
        await api.savePack(head.pack)
        queue = rest
      } else if (head.op === 'patchPack') {
        await api.patchPack(head.incidentId, head.patch)
        queue = rest
      } else {
        await api.addPieces(head.incidentId, head.pieces)
        queue = rest
      }
      writeQueue(queue)
    } catch (err) {
      if (isNetworkFailure(err)) {
        writeQueue(queue)
        return remaps
      }
      // Drop poison pill so the chain can continue; caller may surface error.
      writeQueue(rest)
      throw err
    }
  }

  return remaps
}
