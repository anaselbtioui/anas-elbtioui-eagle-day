import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotoristShell } from '@/app/MotoristShell'
import { DeskShell } from '@/app/DeskShell'
import { SessionExpiryWarning } from '@/components/SessionExpiryWarning'
import { AuthPage } from '@/features/auth/AuthPage'
import { HomePage } from '@/features/home/HomePage'
import { AssistPage } from '@/features/home/AssistPage'
import { PastAccidentsPage } from '@/features/home/PastAccidentsPage'
import { OnboardingPage } from '@/features/onboarding/OnboardingPage'
import { NowPage } from '@/features/now/NowPage'
import { LaterPage } from '@/features/later/LaterPage'
import { BrokerQueuePage } from '@/features/broker/BrokerQueuePage'
import { BrokerDossierPage } from '@/features/broker/BrokerDossierPage'
import { BrokerImportPage } from '@/features/broker/BrokerImportPage'
import { BrokerClientsPage } from '@/features/broker/BrokerClientsPage'
import { AppToast } from '@/components/ui/app-toast'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'
import type { AppRole } from '@/domain/auth.ts'

const queryClient = new QueryClient()

function RootEntry() {
  const user = useSessionStore((s) => s.user)
  const profileOnboarded = useProfileStore((s) => s.profile.onboarded)
  if (user?.role === 'broker') return <Navigate to="/desk" replace />
  if (user?.role === 'motorist') {
    // Fresh signup: shell must not mount (its profile pull used to mark onboarded).
    if (!user.onboarded && !profileOnboarded) return <Navigate to="/onboarding" replace />
    return <MotoristShell />
  }
  return <AuthPage />
}

function RequireAuth({
  role,
  children,
}: {
  role: AppRole
  children: ReactNode
}) {
  const user = useSessionStore((s) => s.user)
  const picked = useSessionStore((s) => s.role)
  if (user) {
    if (user.role !== role) {
      return <Navigate to={user.role === 'broker' ? '/desk' : '/'} replace />
    }
    return children
  }
  if (!picked) return <Navigate to="/" replace />
  return <Navigate to="/auth" replace />
}

function RequireMotoristPage({ children }: { children: ReactNode }) {
  return <RequireAuth role="motorist">{children}</RequireAuth>
}

export function AppRouter() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionExpiryWarning />
        <AppToast />
        <Routes>
          <Route path="/" element={<RootEntry />}>
            <Route
              index
              element={
                <RequireMotoristPage>
                  <HomePage />
                </RequireMotoristPage>
              }
            />
            <Route
              path="past"
              element={
                <RequireMotoristPage>
                  <PastAccidentsPage />
                </RequireMotoristPage>
              }
            />
            <Route
              path="past/:packId"
              element={
                <RequireMotoristPage>
                  <PastAccidentsPage />
                </RequireMotoristPage>
              }
            />
            <Route
              path="now"
              element={
                <RequireMotoristPage>
                  <NowPage />
                </RequireMotoristPage>
              }
            />
            <Route
              path="later"
              element={
                <RequireMotoristPage>
                  <LaterPage />
                </RequireMotoristPage>
              }
            />
            <Route
              path="assist"
              element={
                <RequireMotoristPage>
                  <AssistPage />
                </RequireMotoristPage>
              }
            />
          </Route>
          <Route path="/settings" element={<Navigate to="/" replace />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth role="motorist">
                <OnboardingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/desk"
            element={
              <RequireAuth role="broker">
                <DeskShell />
              </RequireAuth>
            }
          >
            <Route index element={<BrokerQueuePage />} />
            <Route path="clients" element={<BrokerClientsPage />} />
            <Route path="import" element={<BrokerImportPage />} />
            <Route path=":dossierId" element={<BrokerDossierPage />} />
          </Route>
          <Route path="/broker" element={<Navigate to="/desk" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
