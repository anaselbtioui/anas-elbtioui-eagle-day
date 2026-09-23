import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvidencePack } from '@/domain/types.ts'
import {
  clearOfflinePackQueue,
  enqueueCreatePack,
  enqueueSavePack,
  flushOfflinePackQueue,
  peekOfflinePackQueue,
} from './offline-pack-queue.ts'

const savePack = vi.fn()
const createPack = vi.fn()

vi.mock('@/services/api.ts', () => ({
  api: {
    createPack: (...args: unknown[]) => createPack(...args),
    savePack: (...args: unknown[]) => savePack(...args),
    patchPack: vi.fn(),
    addPieces: vi.fn(),
  },
}))

function domainPack(id: string, injury: EvidencePack['incident']['injury'] = 'no'): EvidencePack {
  return {
    incident: {
      id,
      ref: `ACC-${id.replace(/[^a-fA-F0-9]/g, '').slice(0, 8).toUpperCase().padEnd(8, '0')}`,
      motoristId: 'm1',
      policyId: 'p1',
      occurredAt: '2026-01-01T00:00:00.000Z',
      city: 'Casa',
      injury,
      vehicleImmobilised: false,
      otherPartyId: null,
      workCommute: null,
      archivedAt: null,
    },
    otherParty: null,
    evidence: {
      incidentId: id,
      constat: 'absent',
      pv: 'not_needed',
      damageZones: [],
      photos: [],
    },
  }
}

describe('offline pack queue', () => {
  beforeEach(() => {
    clearOfflinePackQueue()
    savePack.mockReset()
    createPack.mockReset()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  })

  it('persists create + coalesced savePack in localStorage', () => {
    enqueueCreatePack({ motoristId: 'm1', city: 'Casa' }, 'client-1')
    enqueueSavePack(domainPack('client-1', 'no'))
    enqueueSavePack(domainPack('client-1', 'yes'))

    const q = peekOfflinePackQueue()
    expect(q).toHaveLength(2)
    expect(q[0]?.op).toBe('createPack')
    expect(q[1]?.op).toBe('savePack')
    if (q[1]?.op === 'savePack') {
      expect(q[1].pack.incident.injury).toBe('yes')
    }
  })

  it('replays in order and remaps client incident id after createPack', async () => {
    enqueueCreatePack({ motoristId: 'm1' }, 'client-1')
    enqueueSavePack(domainPack('client-1', 'no'))

    createPack.mockResolvedValue(domainPack('server-9'))
    savePack.mockResolvedValue(domainPack('server-9'))

    const remaps = await flushOfflinePackQueue()
    expect(remaps).toEqual([{ from: 'client-1', to: 'server-9' }])
    expect(createPack).toHaveBeenCalledOnce()
    expect(savePack).toHaveBeenCalledWith(
      expect.objectContaining({
        incident: expect.objectContaining({ id: 'server-9' }),
      }),
    )
    expect(peekOfflinePackQueue()).toHaveLength(0)
  })

  it('keeps queue when still offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    enqueueSavePack(domainPack('client-1'))
    const remaps = await flushOfflinePackQueue()
    expect(remaps).toEqual([])
    expect(savePack).not.toHaveBeenCalled()
    expect(peekOfflinePackQueue()).toHaveLength(1)
  })
})
