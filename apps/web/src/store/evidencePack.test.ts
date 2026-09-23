import { describe, expect, it } from 'vitest'
import { createEmptyPack } from '@/domain/evidence'
import { mergeArchivedAt } from '@/store/evidencePack'

describe('mergeArchivedAt', () => {
  it('keeps device archive stamp when server pack has none', () => {
    const stamped = {
      ...createEmptyPack(),
      id: 'PACK-1',
      status: 'stopped' as const,
      archivedAt: '2026-09-20T12:00:00.000Z',
    }
    const fromServer = {
      ...createEmptyPack(),
      id: 'PACK-1',
      status: 'stopped' as const,
      archivedAt: null,
    }
    const merged = mergeArchivedAt([fromServer], {
      pack: null,
      history: [stamped],
    })
    expect(merged[0]?.archivedAt).toBe('2026-09-20T12:00:00.000Z')
  })

  it('leaves unstamped packs without archivedAt', () => {
    const fromServer = {
      ...createEmptyPack(),
      id: 'PACK-2',
      status: 'expired' as const,
      archivedAt: null,
    }
    const merged = mergeArchivedAt([fromServer], {
      pack: null,
      history: [],
    })
    expect(merged[0]?.archivedAt).toBeNull()
  })

  it('reads stamp from active pack', () => {
    const active = {
      ...createEmptyPack(),
      id: 'PACK-3',
      status: 'expired' as const,
      archivedAt: '2026-09-21T08:00:00.000Z',
    }
    const fromServer = {
      ...createEmptyPack(),
      id: 'PACK-3',
      status: 'expired' as const,
      archivedAt: null,
    }
    const merged = mergeArchivedAt([fromServer], {
      pack: active,
      history: [],
    })
    expect(merged[0]?.archivedAt).toBe('2026-09-21T08:00:00.000Z')
  })
})
