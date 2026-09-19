import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import type { EvidencePack, EvidencePackStatus } from '@/domain/evidence'
import type { Dossier } from '@/domain/types.ts'
import { api } from '@/services/api.ts'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { showToast } from '@/store/toast'
import { walletClaimReady } from '@/services/wallet.ts'
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

/** Open accidents — not yet a declared sinistre. */
function isOpenAccident(status: EvidencePackStatus): boolean {
  return status === 'draft' || status === 'saved'
}

export function HomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const active = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const start = useEvidenceStore((s) => s.start)
  const resume = useEvidenceStore((s) => s.resume)
  const starting = useEvidenceStore((s) => s.starting)
  const [dossierById, setDossierById] = useState<Record<string, Dossier | null>>({})
  const claimReady = walletClaimReady(profile)

  useEffect(() => {
    if (!profile.onboarded) return
    void api.listPacks(profile.motoristId).then(hydrateFromDomain).catch(() => undefined)
  }, [profile.onboarded, profile.motoristId, hydrateFromDomain])

  const packs = useMemo(() => {
    const byId = new Map<string, EvidencePack>()
    for (const h of history) byId.set(h.id, h)
    if (active) byId.set(active.id, active)
    return [...byId.values()]
      .filter((p) => isOpenAccident(p.status))
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

  async function onNewAccident() {
    await start()
    navigate('/now')
  }

  function openPack(row: EvidencePack) {
    if (row.status === 'draft') {
      resume(row.id)
      navigate('/now')
      return
    }
    if (row.status === 'saved') {
      if (!claimReady) {
        showToast(t('home.laterBlocked'), 'alert')
        return
      }
      resume(row.id)
      navigate('/later')
      return
    }
    navigate(`/past/${row.id}`)
  }

  function goLater() {
    if (!claimReady) {
      showToast(t('home.laterBlocked'), 'alert')
      return
    }
    navigate('/later')
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={goLater}
          className={cn(
            'font-semibold underline-offset-4 hover:underline',
            claimReady ? 'text-ink' : 'text-ink-muted',
          )}
          data-testid="home-door-later"
          aria-disabled={!claimReady}
        >
          {t('home.doorLater')}
        </button>
        <Link
          to="/assist"
          className="font-semibold text-ink underline-offset-4 hover:underline"
          data-testid="home-door-assist"
        >
          {t('home.doorAssist')}
        </Link>
        <span className="text-ink-muted">{t('app.notAClaim')}</span>
      </div>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink md:text-2xl">
            {t('motorist.accidentsTitle')}
          </h2>
          <Button
            className="h-11 min-h-11 shrink-0 gap-2 px-4 text-sm"
            disabled={starting}
            onClick={() => {
              void onNewAccident()
            }}
            data-testid="home-new-accident"
            title={t('home.doorNowHint')}
          >
            <LabasIcon name="warning" className="h-5 w-5 shrink-0" tone="onInk" aria-hidden />
            {starting ? t('now.starting') : t('home.doorNow')}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={packs}
          emptyMessage={t('motorist.claimsEmpty')}
          getRowTestId={(row) => `sinistre-${row.id}`}
          onRowClick={openPack}
        />
      </section>
    </div>
  )
}
