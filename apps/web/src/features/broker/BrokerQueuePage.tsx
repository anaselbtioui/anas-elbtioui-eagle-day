import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { ShellFill, ShellListFrame } from '@/app/AppShell'
import { LifecycleRing } from '@/components/LifecycleRing'
import { DataTable } from '@/components/ui/data-table'
import { LoadingLine } from '@/components/ui/loading-line'
import { filterDeskBundles, type DeskBundle } from '@/domain/desk.ts'
import { dossierLifecycleStages } from '@/domain/lifecycle.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
import type { DossierClosedReason, DossierStatus } from '@/domain/types.ts'
import { cn } from '@/lib/utils'

function statusTone(status: DossierStatus): string {
  switch (status) {
    case 'blocked_missing_evidence':
      return 'text-alert'
    case 'waiting_motorist':
      return 'text-ink'
    case 'with_broker':
      return 'text-moss'
    case 'with_insurer':
      return 'text-ink'
    default:
      return 'text-ink-muted'
  }
}

const STATUS_FILTERS: Array<DossierStatus | 'all' | 'closed'> = [
  'all',
  'blocked_missing_evidence',
  'waiting_motorist',
  'with_broker',
  'with_insurer',
  'draft',
  'declared',
  'closed',
]

/** Stages a dossier would show on the ring when in this filter state. */
function filterLifecycleStages(s: Exclude<DossierStatus | 'closed', 'all'>) {
  if (s === 'closed') {
    return dossierLifecycleStages('with_broker', 'archived' satisfies DossierClosedReason)
  }
  return dossierLifecycleStages(s)
}

export function BrokerQueuePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const bundles = useBrokerDeskStore((s) => s.bundles)
  const loading = useBrokerDeskStore((s) => s.loading)
  const error = useBrokerDeskStore((s) => s.error)
  const loadQueue = useBrokerDeskStore((s) => s.loadQueue)
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'all' | 'closed'>('all')

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  const filtered = useMemo(
    () =>
      filterDeskBundles(bundles, {
        query: '',
        status: statusFilter,
        mineOnly: false,
        brokerName: null,
      }),
    [bundles, statusFilter],
  )

  const columns = useMemo<ColumnDef<DeskBundle>[]>(
    () => [
      {
        id: 'title',
        accessorFn: (row) => row.title,
        header: t('broker.colTitle'),
        cell: ({ row }) => (
          <p className="font-semibold text-ink">{row.original.title}</p>
        ),
      },
      {
        id: 'motorist',
        accessorFn: (row) => row.profile.motorist.name,
        header: t('broker.colMotorist'),
        cell: ({ row }) => (
          <div className="min-w-[8rem]">
            <p>{row.original.profile.motorist.name}</p>
            <p className="text-xs text-ink-muted">{row.original.pack.incident.city}</p>
          </div>
        ),
      },
      {
        id: 'policy',
        accessorFn: (row) => row.profile.policy.number ?? '',
        header: t('broker.colPolicy'),
        cell: ({ row }) => (
          <span className="font-mono text-sm tabular-nums">
            {row.original.profile.policy.number ?? '—'}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => row.dossier.status,
        header: t('broker.colStatus'),
        cell: ({ row }) => {
          const status = row.original.dossier.status
          const closedReason = row.original.dossier.closedReason
          const label = closedReason
            ? t(
                closedReason === 'cancelled'
                  ? 'broker.closedCancelled'
                  : 'broker.closedArchived',
              )
            : t(`broker.status.${status}`)
          return (
            <span
              className={cn(
                'inline-flex items-center gap-2 text-xs font-semibold',
                closedReason ? 'text-alert' : statusTone(status),
              )}
            >
              <LifecycleRing
                stages={dossierLifecycleStages(status, closedReason)}
                label={label}
                size={16}
              />
              {label}
            </span>
          )
        },
      },
      {
        id: 'gaps',
        accessorFn: (row) => row.dossier.missingPieces.join(','),
        header: t('broker.colGaps'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-ink">
            {row.original.dossier.missingPieces.length
              ? row.original.dossier.missingPieces
                  .map((p) => t(`broker.piece.${p}`))
                  .join(', ')
              : t('broker.noGaps')}
          </span>
        ),
      },
      {
        id: 'owner',
        accessorFn: (row) => row.provenance.owner,
        header: t('broker.colOwner'),
        cell: ({ row }) => (
          <span className="text-sm text-ink-muted">{row.original.provenance.owner || '—'}</span>
        ),
      },
      {
        id: 'next',
        accessorFn: (row) => row.dossier.nextHumanStep,
        header: t('broker.colNext'),
        enableSorting: false,
        cell: ({ row }) => (
          <p className="max-w-xs truncate text-sm text-ink-muted" title={row.original.dossier.nextHumanStep}>
            {row.original.dossier.nextHumanStep}
          </p>
        ),
      },
    ],
    [t],
  )

  return (
    <ShellFill>
      <ShellListFrame>
      <div className="mb-5 shrink-0">
        <h1 className="font-display text-3xl font-bold">{t('broker.queueTitle')}</h1>
      </div>

      <div
        className="mb-5 flex shrink-0 flex-wrap gap-2 p-0.5"
        role="tablist"
        aria-label={t('broker.queueTitle')}
      >
        {STATUS_FILTERS.map((s) => {
          const selected = statusFilter === s
          const label = s === 'all' ? t('broker.filterAll') : t(`broker.status.${s}`)
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                selected
                  ? 'bg-ink-soft text-ink ring-1 ring-inset ring-ink/20'
                  : 'bg-sand-deep text-ink-muted hover:text-ink',
              )}
              data-testid={`queue-filter-${s}`}
            >
              {s !== 'all' ? (
                <LifecycleRing
                  stages={filterLifecycleStages(s)}
                  tipStages={[]}
                  label={label}
                  size={14}
                />
              ) : null}
              {label}
            </button>
          )
        })}
      </div>

      {loading ? <LoadingLine /> : null}
      {error ? <p className="mb-3 shrink-0 text-sm text-alert">{error}</p> : null}

      {!loading ? (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={
            bundles.length === 0 ? t('broker.emptyQueue') : t('broker.noMatch')
          }
          getRowTestId={(row) => `dossier-${row.dossierId}`}
          onRowClick={(row) => navigate(`/desk/${row.dossierId}`)}
        />
      ) : null}
      </ShellListFrame>
    </ShellFill>
  )
}
