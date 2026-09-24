import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AppShell, ShellNavLink, shellActiveEntry } from '@/app/AppShell'
import { DesktopOnlyGate } from '@/app/DesktopOnlyGate'
import { Input } from '@/components/ui/input'
import { BrokerSettingsModal } from '@/features/broker/BrokerSettingsModal'
import { filterDeskBundles } from '@/domain/desk.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
import { useBrokerProfileStore } from '@/store/brokerProfile'
import { useSessionStore } from '@/store/session'
import { cn } from '@/lib/utils'

export function DeskShell({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useBrokerDeskStore((s) => s.toast)
  const clearToast = useBrokerDeskStore((s) => s.clearToast)
  const bundles = useBrokerDeskStore((s) => s.bundles)
  const loadQueue = useBrokerDeskStore((s) => s.loadQueue)
  const searchQuery = useBrokerDeskStore((s) => s.searchQuery)
  const setSearchQuery = useBrokerDeskStore((s) => s.setSearchQuery)
  const user = useSessionStore((s) => s.user)
  const pullRemote = useBrokerProfileStore((s) => s.pullRemote)
  const profile = useBrokerProfileStore((s) => s.profile)
  const remoteHydrated = useBrokerProfileStore((s) => s.remoteHydrated)
  const { dossierId } = useParams()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  useEffect(() => {
    void pullRemote()
  }, [pullRemote])

  const filteredDossiers = useMemo(
    () =>
      filterDeskBundles(bundles, {
        query: searchQuery,
        status: 'all',
        mineOnly: false,
        brokerName: null,
      }),
    [bundles, searchQuery],
  )

  const profileName = [profile.firstName, profile.lastName]
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
  const displayName =
    profileName ||
    profile.displayName.trim() ||
    user?.displayName?.trim() ||
    t('broker.badge')
  const avatarUrl = profile.avatarPhotoLocal.trim() || undefined
  const avatarLoading =
    !remoteHydrated && Boolean(profile.avatarPhotoPath.trim()) && !avatarUrl

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const first = filteredDossiers[0]
    if (!first) return
    navigate(`/desk/${first.dossierId}`)
  }

  return (
    <DesktopOnlyGate>
    <>
    <AppShell
      homeTo="/desk"
      navLabel={t('broker.navLabel')}
      displayName={displayName}
      avatarUrl={avatarUrl}
      avatarLoading={avatarLoading}
      avatarTestId="desk-avatar"
      onSettings={() => setSettingsOpen(true)}
      search={
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={t('broker.searchPh')}
          className="min-h-10 border border-border bg-surface/80 px-3 py-2 text-sm"
          data-testid="desk-search"
          aria-label={t('broker.searchPh')}
        />
      }
      nav={
        <>
          <ShellNavLink
            to="/desk"
            end
            icon="clipboard"
            label={t('broker.navQueue')}
            testId="nav-desk-queue"
          />
          <ShellNavLink
            to="/desk/clients"
            icon="user"
            label={t('broker.navClients')}
            testId="nav-desk-clients"
          />
          <ShellNavLink
            to="/desk/import"
            icon="briefcase"
            label={t('broker.navImport')}
            testId="nav-desk-import"
          />
        </>
      }
      listTitle={t('broker.navDossiers')}
      list={
        <ul className="space-y-0.5">
          {filteredDossiers.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-muted">
              {bundles.length === 0 ? t('broker.emptyQueue') : t('broker.noMatch')}
            </li>
          ) : (
            filteredDossiers.slice(0, 24).map((b) => (
              <li key={b.dossierId}>
                <Link
                  to={`/desk/${b.dossierId}`}
                  className={cn(
                    'flex min-h-10 items-center truncate rounded-[var(--radius-labas)] px-3 py-2 text-sm transition-colors',
                    dossierId === b.dossierId
                      ? shellActiveEntry
                      : 'text-ink-muted hover:bg-sand-deep/70 hover:text-ink',
                  )}
                  data-testid={`nav-dossier-${b.dossierId}`}
                >
                  {b.title}
                </Link>
              </li>
            ))
          )}
        </ul>
      }
      toast={
        toast ? (
          <div
            className="border-b border-ink/15 bg-ink-soft px-4 py-2 text-center text-sm font-medium text-ink"
            role="status"
          >
            <span>{toast.includes('.') ? t(toast) : toast}</span>
            <button type="button" className="ml-3 text-ink underline" onClick={clearToast}>
              {t('app.close')}
            </button>
          </div>
        ) : null
      }
    >
      {children}
    </AppShell>
    <BrokerSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
    </DesktopOnlyGate>
  )
}
