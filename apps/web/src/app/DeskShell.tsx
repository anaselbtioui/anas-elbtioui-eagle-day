import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppShell, ShellNavLink, shellActiveEntry } from '@/app/AppShell'
import { DesktopOnlyGate } from '@/app/DesktopOnlyGate'
import type { CommandPaletteItem } from '@/components/CommandPalette'
import { LabasIcon } from '@/components/LabasIcon'
import { LifecycleRing } from '@/components/LifecycleRing'
import { concernedLifecycleStages } from '@/components/RecentPackRow'
import { FluidHover } from '@/components/ui/fluid-hover'
import { BrokerSettingsModal } from '@/features/broker/BrokerSettingsModal'
import { ReleaseNotesHost } from '@/components/ReleaseNotesHost'
import { filterDeskBundles, type DeskBundle } from '@/domain/desk.ts'
import { dossierLifecycleStages } from '@/domain/lifecycle.ts'
import type { DossierStatus } from '@/domain/types.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
import { useBrokerProfileStore } from '@/store/brokerProfile'
import { useSessionStore } from '@/store/session'
import { fullTimestamp, shortRelative } from '@/lib/relative-time'
import { cn } from '@/lib/utils'

type SidebarSort = 'recent' | 'status'

/** Urgent / actionable first — closed last. */
const STATUS_SORT_RANK: Record<DossierStatus, number> = {
  blocked_missing_evidence: 0,
  waiting_motorist: 1,
  with_broker: 2,
  declared: 3,
  draft: 4,
  with_insurer: 5,
}

function dossierStatusRank(bundle: DeskBundle): number {
  if (bundle.dossier.closedReason) return 90
  return STATUS_SORT_RANK[bundle.dossier.status] ?? 50
}

function firstParseableIso(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    if (!c) continue
    if (!Number.isNaN(Date.parse(c))) return c
  }
  return ''
}

function stampOf(bundle: DeskBundle): string {
  return firstParseableIso(
    bundle.provenance.freshness,
    bundle.events[0]?.at,
    bundle.pack.incident.occurredAt,
  )
}

export function DeskShell({ children }: { children?: ReactNode }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const toast = useBrokerDeskStore((s) => s.toast)
  const clearToast = useBrokerDeskStore((s) => s.clearToast)
  const bundles = useBrokerDeskStore((s) => s.bundles)
  const loadQueue = useBrokerDeskStore((s) => s.loadQueue)
  const user = useSessionStore((s) => s.user)
  const pullRemote = useBrokerProfileStore((s) => s.pullRemote)
  const profile = useBrokerProfileStore((s) => s.profile)
  const remoteHydrated = useBrokerProfileStore((s) => s.remoteHydrated)
  const { dossierId } = useParams()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarSort, setSidebarSort] = useState<SidebarSort>('recent')

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  useEffect(() => {
    void pullRemote()
  }, [pullRemote])

  const recentDossiers = useMemo(() => {
    const open = filterDeskBundles(bundles, {
      query: '',
      status: 'all',
      mineOnly: false,
      brokerName: null,
    })
    const sorted =
      sidebarSort === 'status'
        ? [...open].sort((a, b) => {
            const rank = dossierStatusRank(a) - dossierStatusRank(b)
            if (rank !== 0) return rank
            return stampOf(b).localeCompare(stampOf(a))
          })
        : open
    return sorted.slice(0, 24)
  }, [bundles, sidebarSort])

  const searchHits = useMemo(
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

  const commandItems: CommandPaletteItem[] = searchHits.map((b) => ({
    id: b.dossierId,
    title: b.title,
    subtitle: b.profile.motorist.name,
    icon: (
      <LabasIcon name="clipboard" className="h-4 w-4 shrink-0" tone="onSand" aria-hidden />
    ),
    onSelect: () => navigate(`/desk/${b.dossierId}`),
  }))

  let recentList: ReactNode
  if (recentDossiers.length === 0) {
    recentList = (
      <ul className="space-y-0.5">
        <li className="px-3 py-2 text-sm text-ink-muted">{t('broker.emptyQueue')}</li>
      </ul>
    )
  } else {
    recentList = (
      <FluidHover>
        <ul className="space-y-0.5">
          {recentDossiers.map((b) => {
            const closedReason = b.dossier.closedReason
            const stages = dossierLifecycleStages(b.dossier.status, closedReason)
            const tipStages = concernedLifecycleStages(stages)
            const statusLabel = closedReason
              ? t(
                  closedReason === 'cancelled'
                    ? 'broker.closedCancelled'
                    : 'broker.closedArchived',
                )
              : t(`broker.status.${b.dossier.status}`)
            const stamp = stampOf(b)
            const active = dossierId === b.dossierId
            return (
              <li key={b.dossierId} className="group/row relative">
                <Link
                  to={`/desk/${b.dossierId}`}
                  data-fluid-item
                  className={cn(
                    'relative z-[1] flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-labas)] px-3 py-2.5 text-left text-sm leading-none',
                    active
                      ? shellActiveEntry
                      : 'bg-transparent text-ink-muted hover:text-ink',
                  )}
                  data-testid={`nav-dossier-${b.dossierId}`}
                >
                  <LifecycleRing
                    stages={stages}
                    tipStages={tipStages}
                    label={statusLabel}
                    size={16}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold leading-normal">
                    {b.title}
                  </span>
                  <span
                    className="shrink-0 self-center tabular-nums text-[0.6875rem] font-medium leading-none text-ink-muted/80"
                    title={fullTimestamp(stamp, i18n.language)}
                  >
                    {shortRelative(stamp, i18n.language)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </FluidHover>
    )
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
      commandSearch={{
        title: t('broker.searchTitle'),
        placeholder: t('broker.searchPh'),
        emptyLabel: t('broker.noMatch'),
        query: searchQuery,
        onQueryChange: setSearchQuery,
        items: commandItems,
        inputTestId: 'desk-search',
      }}
      searchLabel={t('broker.searchPh')}
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
        </>
      }
      listTitle={
        <div className="flex items-center justify-between gap-2">
          <span>{t('broker.navDossiers')}</span>
          <div className="relative shrink-0">
            <LabasIcon
              name="sort"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
              aria-hidden
            />
            <label className="sr-only" htmlFor="desk-sidebar-sort">
              {t('broker.sortLabel')}
            </label>
            <select
              id="desk-sidebar-sort"
              value={sidebarSort}
              onChange={(e) => setSidebarSort(e.target.value as SidebarSort)}
              className={cn(
                'h-8 max-w-[8.5rem] appearance-none truncate rounded-full border-0',
                'bg-sand-deep py-1 pl-8 pr-3 text-[0.6875rem] font-semibold text-ink',
                'outline-none transition-colors hover:text-ink',
                'ring-1 ring-inset ring-ink/15',
                'focus-visible:bg-ink-soft focus-visible:ring-2 focus-visible:ring-ink/25',
              )}
              data-testid="desk-sidebar-sort"
              title={t('broker.sortLabel')}
            >
              <option value="recent">{t('broker.sortRecent')}</option>
              <option value="status">{t('broker.sortByStatus')}</option>
            </select>
          </div>
        </div>
      }
      list={recentList}
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
    <ReleaseNotesHost audience="broker" />
    </>
    </DesktopOnlyGate>
  )
}
