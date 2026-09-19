import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { DataTable } from '@/components/ui/data-table'
import { filterDeskBundles, type DeskBundle } from '@/domain/desk.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
import type { DossierStatus } from '@/domain/types.ts'
import { cn } from '@/lib/utils'

function statusTone(status: DossierStatus): string {
  switch (status) {
    case 'blocked_missing_evidence':
      return 'bg-alert-soft text-alert'
    case 'waiting_motorist':
      return 'bg-sand-deep text-ink'
    case 'with_broker':
      return 'bg-moss-soft text-moss'
    case 'with_insurer':
      return 'bg-ink/10 text-ink'
    default:
      return 'bg-sand-deep text-ink-muted'
  }
}

const STATUS_FILTERS: Array<DossierStatus | 'all'> = [
  'all',
  'blocked_missing_evidence',
  'waiting_motorist',
  'with_broker',
  'with_insurer',
  'draft',
  'declared',
]

export function BrokerQueuePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const bundles = useBrokerDeskStore((s) => s.bundles)
  const loading = useBrokerDeskStore((s) => s.loading)
  const error = useBrokerDeskStore((s) => s.error)
  const loadQueue = useBrokerDeskStore((s) => s.loadQueue)
  const searchQuery = useBrokerDeskStore((s) => s.searchQuery)
  const [statusFilter, setStatusFilter] = useState<DossierStatus | 'all'>('all')

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  const filtered = useMemo(
    () =>
      filterDeskBundles(bundles, {
        query: searchQuery,
        status: statusFilter,
        mineOnly: false,
        brokerName: null,
      }),
    [bundles, searchQuery, statusFilter],
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
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex rounded-[var(--radius-labas)] px-2.5 py-1 text-xs font-semibold',
              statusTone(row.original.dossier.status),
            )}
          >
            {t(`broker.status.${row.original.dossier.status}`)}
          </span>
        ),
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
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">{t('broker.queueTitle')}</h1>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-[var(--radius-labas)] px-3 py-1.5 text-xs font-semibold transition-colors',
              statusFilter === s
                ? 'bg-ink-soft text-ink outline outline-1 outline-ink/20'
                : 'bg-sand-deep text-ink-muted hover:text-ink',
            )}
          >
            {s === 'all' ? t('broker.filterAll') : t(`broker.status.${s}`)}
          </button>
        ))}
      </div>

      {loading ? <p className="text-ink-muted">{t('later.loading')}</p> : null}
      {error ? <p className="mb-3 text-sm text-alert">{error}</p> : null}

      {!loading && bundles.length === 0 ? (
        <div className="rounded-[var(--radius-labas)] bg-sand-deep px-4 py-4">
          <p className="text-ink-muted">{t('broker.emptyQueue')}</p>
        </div>
      ) : null}

      {!loading && bundles.length > 0 ? (
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage={t('broker.noMatch')}
          getRowTestId={(row) => `dossier-${row.dossierId}`}
          onRowClick={(row) => navigate(`/desk/${row.dossierId}`)}
        />
      ) : null}
    </>
  )
}
