import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { LabasIcon } from '@/components/LabasIcon'
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

function isOpenSinistre(status: EvidencePackStatus): boolean {
  return status === 'draft' || status === 'saved'
}

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
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
      .filter((p) => isOpenSinistre(p.status))
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
          <p className="font-mono text-sm font-semibold text-ink">{row.original.id.slice(0, 14)}</p>
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
    [t, dossierById],
  )

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="home-doors">
        <Door
          to="/now"
          icon={<LabasIcon name="warning" className="h-7 w-7" tone="onInk" aria-hidden />}
          title={t('home.doorNow')}
          hint={t('home.doorNowHint')}
          primary
          className="home-door-primary"
        />
        <Door
          to="/later"
          icon={<LabasIcon name="clipboard" className="h-7 w-7" tone="onSand" aria-hidden />}
          title={t('home.doorLater')}
          hint={t('home.doorLaterHint')}
        />
        <Door
          to="/assist"
          icon={<LabasIcon name="wrench" className="h-7 w-7" tone="onSand" aria-hidden />}
          title={t('home.doorAssist')}
          hint={t('home.doorAssistHint')}
        />
      </div>

      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <LabasIcon name="car" className="h-5 w-5" aria-hidden />
        {t('app.notAClaim')}
      </p>

      <section>
        <h2 className="font-display mb-4 text-xl font-bold text-ink md:text-2xl">
          {t('motorist.navClaims')}
        </h2>
        <DataTable
          columns={columns}
          data={packs}
          emptyMessage={t('motorist.claimsEmpty')}
          getRowTestId={(row) => `sinistre-${row.id}`}
          onRowClick={(row) => {
            if (row.status === 'draft') navigate('/now')
            else if (row.status === 'saved') navigate('/later')
            else navigate(`/past/${row.id}`)
          }}
        />
      </section>
    </div>
  )
}

function Door({
  to,
  icon,
  title,
  hint,
  primary,
  className,
}: {
  to: string
  icon: ReactNode
  title: string
  hint: string
  primary?: boolean
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        primary
          ? 'flex min-h-20 items-start gap-4 rounded-[var(--radius-labas)] bg-ink p-5 text-sand transition-transform active:scale-[0.96]'
          : 'flex min-h-20 items-start gap-4 rounded-[var(--radius-labas)] border-2 border-border bg-surface/90 p-5 text-ink surface-card transition-transform active:scale-[0.96]',
        className,
      )}
    >
      <span className={primary ? 'text-sand' : 'text-ink'}>{icon}</span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span
          className={
            primary ? 'mt-1 block text-sm text-sand/80' : 'mt-1 block text-sm text-ink-muted'
          }
        >
          {hint}
        </span>
      </span>
    </Link>
  )
}
