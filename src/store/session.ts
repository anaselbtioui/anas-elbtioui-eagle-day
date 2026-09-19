import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppRole, AuthUser } from '@/domain/auth.ts'
import { setAuthToken } from '@/services/auth-token.ts'
import { emptyWallet } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile.ts'

export type { AppRole }

interface SessionState {
  role: AppRole | null
  brokerName: string | null
  token: string | null
  user: AuthUser | null
  setRole: (role: AppRole) => void
  applyAuth: (token: string, user: AuthUser) => void
  signOut: () => void
  /** Drop token/user; keep role picker entry (motorist vs broker). */
  signOutKeepEntry: () => void
  clearRole: () => void
}

function syncProfile(user: AuthUser): void {
  const current = useProfileStore.getState().profile
  const sameMotorist = Boolean(current.motoristId && current.motoristId === (user.motoristId ?? ''))
  useProfileStore.setState({
    profile: {
      ...(sameMotorist ? current : emptyWallet),
      motoristId: user.motoristId ?? '',
      vehicleId: user.vehicleId ?? '',
      insurerId: user.insurerId ?? '',
      brokerId: user.brokerId ?? '',
      policyId: user.policyId ?? '',
      name: sameMotorist && current.name ? current.name : user.displayName,
      onboarded:
        user.role === 'broker'
          ? false
          : Boolean(user.onboarded || (sameMotorist && current.onboarded)),
    },
    error: null,
  })
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      brokerName: null,
      token: null,
      user: null,
      setRole: (role) => set({ role }),
      applyAuth: (token, user) => {
        setAuthToken(token)
        syncProfile(user)
        set({
          token,
          user,
          role: user.role,
          brokerName: user.role === 'broker' ? user.displayName : null,
        })
      },
      signOut: () => {
        setAuthToken(null)
        useProfileStore.getState().reset()
        set({ role: null, token: null, user: null, brokerName: null })
      },
      signOutKeepEntry: () => {
        setAuthToken(null)
        useProfileStore.getState().reset()
        set({ token: null, user: null, brokerName: null })
      },
      clearRole: () => {
        setAuthToken(null)
        useProfileStore.getState().reset()
        set({ role: null, token: null, user: null, brokerName: null })
      },
    }),
    {
      name: 'labas-session-v3',
      partialize: (s) => ({
        role: s.role,
        brokerName: s.brokerName,
        token: s.token,
        user: s.user,
      }),
      onRehydrateStorage: () => (state) => {
        setAuthToken(state?.token ?? null)
        if (state?.user) syncProfile(state.user)
      },
    },
  ),
)
