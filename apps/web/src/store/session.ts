import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppRole, AuthUser } from '@/domain/auth.ts'
import { setAuthToken } from '@/services/auth-token.ts'
import { emptyWallet, migrateWalletNames, type Wallet } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile.ts'

export type { AppRole }

interface SessionState {
  role: AppRole | null
  brokerName: string | null
  token: string | null
  user: AuthUser | null
  setRole: (role: AppRole) => void
  applyAuth: (token: string, user: AuthUser) => void
  /** Patch cached auth user (e.g. displayName after wallet save). */
  patchUser: (patch: Partial<AuthUser>) => void
  signOut: () => void
  /** Drop token/user; keep role picker entry (motorist vs broker). */
  signOutKeepEntry: () => void
  clearRole: () => void
}

/** Auth → wallet: ids + seed names; full fields come from pullRemoteProfile. */
export function syncProfile(user: AuthUser): void {
  const state = useProfileStore.getState()
  const current = state.profile
  const sameMotorist = Boolean(current.motoristId && current.motoristId === (user.motoristId ?? ''))
  // Prefer wallet broker link — auth JWT may lag behind PUT /api/profile until refresh.
  const brokerId =
    (sameMotorist && current.brokerId.trim()) || user.brokerId || ''
  // Keep local onboarded across JWT lag after completeProfile (match pullRemoteProfile).
  const onboarded =
    user.role === 'broker' ? false : Boolean(user.onboarded) || (sameMotorist && current.onboarded)

  if (!sameMotorist) {
    const named = migrateWalletNames({
      ...emptyWallet,
      name: user.displayName,
    } as Wallet & { name?: string })
    const next: Wallet = {
      ...named,
      motoristId: user.motoristId ?? '',
      vehicleId: user.vehicleId ?? '',
      insurerId: user.insurerId ?? '',
      brokerId,
      policyId: user.policyId ?? '',
      onboarded,
    }
    useProfileStore.setState({
      profile: next,
      serverProfile: next,
      draft: {},
      error: null,
      remoteHydrated: false,
    })
    return
  }

  const named = migrateWalletNames({
    ...state.serverProfile,
    name: user.displayName,
  } as Wallet & { name?: string })
  const server: Wallet = {
    ...named,
    motoristId: user.motoristId ?? '',
    vehicleId: user.vehicleId ?? state.serverProfile.vehicleId,
    insurerId: user.insurerId ?? state.serverProfile.insurerId,
    brokerId,
    policyId: user.policyId ?? state.serverProfile.policyId,
    onboarded,
    // Prefer existing server names; only seed when blank.
    firstName: state.serverProfile.firstName.trim() || named.firstName,
    lastName: state.serverProfile.lastName.trim() || named.lastName,
  }
  useProfileStore.setState({
    serverProfile: server,
    draft: state.draft,
    profile: { ...server, ...state.draft },
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
      patchUser: (patch) => {
        set((s) => {
          if (!s.user) return s
          const user = { ...s.user, ...patch }
          return {
            user,
            brokerName: user.role === 'broker' ? user.displayName : s.brokerName,
          }
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
