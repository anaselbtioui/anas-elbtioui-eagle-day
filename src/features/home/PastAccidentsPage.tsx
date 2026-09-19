import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { DataTable } from '@/components/ui/data-table'
import type { EvidencePack, EvidencePackStatus } from '@/domain/evidence'
import type { Dossier } from '@/domain/types.ts'
import { api } from '@/services/api.ts'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { cn } from '@/lib/utils'

function statusTone(status: EvidencePackStatus): string {
  switch (status) {
    case 'saved':
      return 'bg-moss-soft text-moss'
    case 'stopped':
      return 'bg-alert-soft text-alert'
    default:
      return 'bg-sand-deep text-ink-muted'
  }
}

function isPasse(status: EvidencePackStatus): boolean {
  return status === 'stopped'
}

export function PastAccidentsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { packId } = useParams()
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const active = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const [dossierById, setDossierById] = useState<Record<string, Dossier | null>>({})

  useEffect(() => {
    if (!profile.onboarded) return
    void api.listPacks(profile.motoristId).then(hydrateFromDomain).catch(() => undefined)
  }, [profile.onboarded, profile.motoristId, hydrateFromDomain])

  const packs = useMemo(() => {
    const byId = new Map<string, EvidencePack>()
    for (const h of history) byId.set(h.id, h)
    if (active) byId.set(active.id, active)
    return [...byId.values()]
      .filter((p) => isPasse(p.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [history, active])

  const savedIds = useMemo(
    () => packs.filter((p) => p.status === 'saved').map((p) => p.id),
    [packs],
  )

  useEffect(() => {
    let cancelled = false
    for (const id of savedIds) {
      void api
        .getFile(id)
        .then((file) => {
          if (!cancelled) {
            setDossierById((prev) => ({ ...prev, [id]: file.dossier }))
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDossierById((prev) => ({ ...prev, [id]: null }))
          }
        })
    }
    return () => {
      cancelled = true
    }
  }, [savedIds])

  const columns = useMemo<ColumnDef<EvidencePack>[]>(
    () => [
      {
        id: 'ref',
        accessorFn: (row) => row.id,
        header: t('motorist.colRef'),
        cell: ({ row }) => (
          <p
            className={cn(
              'font-mono text-sm font-semibold text-ink',
              packId === row.original.id && 'underline decoration-ink/40',
            )}
          >
            {row.original.id.slice(0, 14)}
          </p>
        ),
      },
      {
        id: 'updated',
        accessorFn: (row) => row.updatedAt,
        header: t('motorist.colUpdated'),
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-ink-muted">
            {row.original.updatedAt.slice(0, 10)}
          </span>
        ),
      },
      {
        id: 'status',
        accessorFn: (row) => row.status,
        header: t('motorist.colStatus'),
        cell: ({ row }) => (
          <span
            className={cn(
              'inline-flex rounded-[var(--radius-labas)] px-2.5 py-1 text-xs font-semibold',
              statusTone(row.original.status),
            )}
          >
            {t(`motorist.packStatus.${row.original.status}`)}
          </span>
        ),
      },
      {
        id: 'dossier',
        accessorFn: (row) => dossierById[row.id]?.status ?? '',
        header: t('motorist.colDossier'),
        enableSorting: false,
        cell: ({ row }) => {
          const dossier = dossierById[row.original.id]
          if (!dossier) return <span className="text-sm text-ink-muted">—</span>
          return (
            <span className="text-sm text-ink">{t(`broker.status.${dossier.status}`)}</span>
          )
        },
      },
      {
        id: 'next',
        accessorFn: (row) => row.status,
        header: t('motorist.colNext'),
        enableSorting: false,
        cell: ({ row }) => (
          <p className="max-w-xs truncate text-sm text-ink-muted">
            {t(`motorist.packStatusHint.${row.original.status}`)}
          </p>
        ),
      },
    ],
    [t, dossierById, packId],
  )

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          {t('motorist.pastTitle')}
        </h1>
      </header>

      <DataTable
        columns={columns}
        data={packs}
        emptyMessage={t('motorist.pastEmpty')}
        getRowTestId={(row) => `past-pack-${row.id}`}
        onRowClick={(row) => navigate(`/past/${row.id}`)}
      />
    </div>
  )
}
