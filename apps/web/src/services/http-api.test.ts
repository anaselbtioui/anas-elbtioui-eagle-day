import { beforeEach, describe, expect, it, vi } from 'vitest'

const signOut = vi.fn()
const getState = vi.fn(() => ({ token: 'ghost-jwt', signOut }))

vi.mock('@/store/session.ts', () => ({
  useSessionStore: { getState },
}))

import { httpApi } from './http-api.ts'

describe('httpApi 401', () => {
  beforeEach(() => {
    signOut.mockClear()
    getState.mockReturnValue({ token: 'ghost-jwt', signOut })
  })

  it('signs out when a stored token is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
      ),
    )
    await expect(httpApi.me()).rejects.toThrow('unauthorized')
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledTimes(1))
    vi.unstubAllGlobals()
  })

  it('does not sign out on a failed sign-in', async () => {
    getState.mockReturnValue({ token: null, signOut })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'invalid_credentials' }), { status: 401 }),
      ),
    )
    await expect(httpApi.signIn({ email: 'a@b.c', password: 'x' })).rejects.toThrow(
      'invalid_credentials',
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(signOut).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
