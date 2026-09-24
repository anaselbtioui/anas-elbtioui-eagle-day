import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { ShellListFrame, ShellScroll } from '@/app/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { LabasIcon } from '@/components/LabasIcon'
import { LifecycleRing } from '@/components/LifecycleRing'
import { displayAccidentRef } from '@/domain/accident-ref'
import {
  canArchivePack,
  isPackArchived,
  type EvidencePack,
  type EvidencePackStatus,
} from '@/domain/evidence'
import { packLifecycleStages } from '@/domain/lifecycle.ts'
import { openMotoristPack } from '@/features/home/openMotoristPack'
import { api } from '@/services/api.ts'
import { walletClaimReady } from '@/services/wallet.ts'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { showToast } from '@/store/toast'
import {
  accidentDisplayTitle,
  accidentLabelCopyFromT,
} from '@/lib/accident-label'
import { fullTimestamp, relativeTime } from '@/lib/relative-time'
import { cn } from '@/lib/utils'

type PastFilter = 'all' | 'archived'

function statusTone(status: EvidencePackStatus): string {
  switch (status) {
    case 'saved':
      return 'text-moss'
    case 'stopped':
      return 'text-alert'
    case 'expired':
      return 'text-ink-muted'
    default:
      return 'text-ink-muted'
  }
}

function isPasse(status: EvidencePackStatus): boolean {
  return status === 'stopped' || status === 'expired'
}

export function PastAccidentsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { packId } = useParams()
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const active = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const packsStatus = useEvidenceStore((s) => s.packsStatus)
  const beginPacksLoad = useEvidenceStore((s) => s.beginPacksLoad)
  const finishPacksLoad = useEvidenceStore((s) => s.finishPacksLoad)
  const archivePack = useEvidenceStore((s) => s.archivePack)
  const unarchivePack = useEvidenceStore((s) => s.unarchivePack)
  const resume = useEvidenceStore((s) => s.resume)
  const claimReady = walletClaimReady(profile)
  const [filter, setFilter] = useState<PastFilter>('all')

  useEffect(() => {
    if (!profile.onboarded) return
    beginPacksLoad()
    void api
      .listPacks(profile.motoristId)
      .then(hydrateFromDomain)
      .catch(() => undefined)
      .finally(() => finishPacksLoad())
  }, [
    profile.onboarded,
    profile.motoristId,
    hydrateFromDomain,
    beginPacksLoad,
    finishPacksLoad,
  ])

  const allPacks = useMemo(() => {
    const byId = new Map<string, EvidencePack>()
    for (const h of history) byId.set(h.id, h)
    if (active) byId.set(active.id, active)
    return [...byId.values()]
  }, [history, active])

  const packs = useMemo(() => {
    const past = allPacks.filter((p) => isPasse(p.status))
    const filtered =
      filter === 'archived'
        ? past.filter((p) => isPackArchived(p))
        : past.filter((p) => !isPackArchived(p))
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [allPacks, filter])

  const selected = useMemo(
    () => (packId ? allPacks.find((p) => p.id === packId) : undefined),
    [allPacks, packId],
  )

  /** Draft / saved → open the right flow instead of empty Passés highlight. */
  useEffect(() => {
    if (!packId || !selected) return
    if (selected.status === 'stopped' || selected.status === 'expired') return
    openMotoristPack({
      pack: selected,
      packId,
      resume,
      navigate,
      claimReady,
      onLaterBlocked: () => showToast(t('home.laterBlocked'), 'alert'),
      onExpired: () => showToast(t('now.expiredToast'), 'alert'),
    })
  }, [packId, selected, resume, navigate, claimReady, t])

  const labelCopy = useMemo(() => accidentLabelCopyFromT(t), [t])
  const cityFallback = profile.city.trim() || null

  const columns = useMemo<ColumnDef<EvidencePack>[]>(
    () => [
      {
        id: 'ref',
        accessorFn: (row) =>
          accidentDisplayTitle(
            { ...row, city: row.city || cityFallback },
            labelCopy,
          ),
        header: t('motorist.colAccident'),
        cell: ({ row }) => {
          const pack = row.original
          const title = accidentDisplayTitle(
            { ...pack, city: pack.city || cityFallback },
            labelCopy,
          )
          const ref = displayAccidentRef(pack.ref, pack.id)
          return (
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate text-sm font-semibold text-ink',
                  packId === pack.id && 'underline decoration-ink/40',
                )}
                title={title}
              >
                {title}
              </p>
              <p className="font-mono text-xs text-ink-muted" title={ref}>
                {ref}
              </p>
            </div>
          )
        },
      },
      {
        id: 'updated',
        accessorFn: (row) => row.updatedAt,
        header: t('motorist.colUpdated'),
        cell: ({ row }) => (
          <span
            className="text-sm text-ink-muted"
            title={fullTimestamp(row.original.updatedAt, i18n.language)}
          >
            {relativeTime(row.original.updatedAt, i18n.language)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('motorist.colStatus'),
        cell: ({ row }) => {
          const status = row.original.status
          return (
            <span className={cn('text-xs font-semibold', statusTone(status))}>
              {t(`motorist.packStatus.${status}`)}
            </span>
          )
        },
      },
      {
        id: 'lifecycle',
        accessorFn: (row) => row.status,
        header: () => <span className="sr-only">{t('motorist.colLifecycle')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const status = row.original.status
          const label = t(`motorist.packStatus.${status}`)
          return (
            <div className="flex justify-end">
              <LifecycleRing
                stages={packLifecycleStages(status)}
                label={label}
                size={18}
              />
            </div>
          )
        },
      },
      {
        id: 'actions',
        accessorFn: (row) => row.archivedAt ?? '',
        header: () => <span className="sr-only">{t('motorist.colActions')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const pack = row.original
          if (isPackArchived(pack)) {
            return (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-labas)] text-ink-muted transition-colors hover:bg-sand-deep hover:text-ink"
                title={t('motorist.unarchive')}
                aria-label={t('motorist.unarchive')}
                data-testid={`unarchive-pack-${pack.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  unarchivePack(pack.id)
                }}
              >
                <LabasIcon name="inbox" className="h-4 w-4" aria-hidden />
              </button>
            )
          }
          if (!canArchivePack(pack)) return null
          return (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-labas)] text-ink-muted transition-colors hover:bg-sand-deep hover:text-ink"
              title={t('motorist.archive')}
              aria-label={t('motorist.archive')}
              data-testid={`archive-pack-${pack.id}`}
              onClick={(e) => {
                e.stopPropagation()
                archivePack(pack.id)
              }}
            >
              <LabasIcon name="archive" className="h-4 w-4" aria-hidden />
            </button>
          )
        },
      },
    ],
    [t, packId, labelCopy, cityFallback, archivePack, unarchivePack, i18n.language],
  )

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  const detail =
    selected?.status === 'stopped' || selected?.status === 'expired' ? selected : undefined

  return (
    <ShellScroll>
      <ShellListFrame className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
            {t('motorist.pastTitle')}
          </h1>
          <div className="flex flex-wrap gap-2 p-0.5">
            {(
              [
                ['all', 'motorist.pastFilterAll'],
                ['archived', 'motorist.pastFilterArchived'],
              ] as const
            ).map(([id, key]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-[var(--radius-labas)] px-3 py-2 text-xs font-semibold transition-colors',
                  filter === id
                    ? 'bg-ink-soft text-ink ring-1 ring-inset ring-ink/20'
                    : 'bg-sand-deep text-ink-muted hover:text-ink',
                )}
                data-testid={`past-filter-${id}`}
              >
                {t(key)}
              </button>
            ))}
          </div>
        </header>

        {detail ? (
          <Card data-testid="past-pack-detail">
            <CardTitle className="font-mono text-lg">
              {displayAccidentRef(detail.ref, detail.id)}
            </CardTitle>
            <CardDescription className="mt-2 space-y-1 text-ink">
              <p>
                {t('motorist.colStatus')}: {t(`motorist.packStatus.${detail.status}`)}
              </p>
              <p>
                {t('motorist.colUpdated')}: {fullTimestamp(detail.updatedAt, i18n.language)}
              </p>
              <p className="text-ink-muted">{t(`motorist.packStatusHint.${detail.status}`)}</p>
            </CardDescription>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="ghost">
                <Link to="/past">{t('app.back')}</Link>
              </Button>
              {isPackArchived(detail) ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  title={t('motorist.unarchive')}
                  aria-label={t('motorist.unarchive')}
                  data-testid={`unarchive-pack-${detail.id}`}
                  onClick={() => unarchivePack(detail.id)}
                >
                  <LabasIcon name="inbox" className="h-5 w-5" aria-hidden />
                </Button>
              ) : canArchivePack(detail) ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  title={t('motorist.archive')}
                  aria-label={t('motorist.archive')}
                  data-testid={`archive-pack-${detail.id}`}
                  onClick={() => {
                    archivePack(detail.id)
                    navigate('/past')
                  }}
                >
                  <LabasIcon name="archive" className="h-5 w-5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </Card>
        ) : null}

        {packId && !selected ? (
          <p className="text-sm text-ink-muted" data-testid="past-pack-missing">
            {t('motorist.packMissing')}
          </p>
        ) : null}

        <DataTable
          columns={columns}
          data={packs}
          emptyMessage={
            filter === 'archived'
              ? t('motorist.pastEmptyArchived')
              : t('motorist.pastEmpty')
          }
          loading={packsStatus !== 'ready' && allPacks.length === 0}
          loadingLabel={t('motorist.loadingClaims')}
          getRowTestId={(row) => `past-pack-${row.id}`}
          onRowClick={(row) => navigate(`/past/${row.id}`)}
        />
      </ShellListFrame>
    </ShellScroll>
  )
}
