import { useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/table-core'
import { ShellListFrame, ShellScroll } from '@/app/AppShell'
import { LabasIcon } from '@/components/LabasIcon'
import { LifecycleRing } from '@/components/LifecycleRing'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/data-table'
import { displayAccidentRef } from '@/domain/accident-ref'
import {
  accidentDisplayTitle,
  accidentLabelCopyFromT,
} from '@/lib/accident-label'
import {
  canArchivePack,
  isNowDraftExpired,
  isPackArchived,
  type EvidencePack,
  type EvidencePackStatus,
} from '@/domain/evidence'
import { packDeclareBlocked, packLifecycleStages } from '@/domain/lifecycle.ts'
import { api } from '@/services/api.ts'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { openMotoristPack } from '@/features/home/openMotoristPack'
import { showToast } from '@/store/toast'
import { walletClaimReady } from '@/services/wallet.ts'
import { fullTimestamp, relativeTime } from '@/lib/relative-time'
import { cn } from '@/lib/utils'

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

/** Open accidents — not yet a declared sinistre (expired = closed). */
function isOpenAccident(status: EvidencePackStatus): boolean {
  return status === 'draft' || status === 'saved'
}

/** Row stays visible but not openable; status/ring still explain the gate. */
function isAccidentRowDisabled(pack: EvidencePack, claimReady: boolean): boolean {
  if (pack.status === 'expired' || isNowDraftExpired(pack)) return true
  return packDeclareBlocked(pack.status, claimReady)
}

export function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const active = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const start = useEvidenceStore((s) => s.start)
  const resume = useEvidenceStore((s) => s.resume)
  const starting = useEvidenceStore((s) => s.starting)
  const archivePack = useEvidenceStore((s) => s.archivePack)
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
      .filter((p) => isOpenAccident(p.status) && !isPackArchived(p))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [history, active])

  const labelCopy = useMemo(() => accidentLabelCopyFromT(t), [t])

  const columns = useMemo<ColumnDef<EvidencePack>[]>(
    () => [
      {
        id: 'ref',
        accessorFn: (row) =>
          accidentDisplayTitle(
            { ...row, city: row.city || profile.city.trim() || null },
            labelCopy,
          ),
        header: t('motorist.colAccident'),
        cell: ({ row }) => {
          const pack = row.original
          const title = accidentDisplayTitle(
            { ...pack, city: pack.city || profile.city.trim() || null },
            labelCopy,
          )
          const ref = displayAccidentRef(pack.ref, pack.id)
          return (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink" title={title}>
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
          const pack = row.original
          const status = pack.status
          const disabled = isAccidentRowDisabled(pack, claimReady)
          const stages = packLifecycleStages(status, {
            walletReady: claimReady,
            createdAt: pack.createdAt,
          })
          const blockKey = stages.find((s) => s.state === 'active' && s.block)?.block
            ?.titleKey
          const label = t(`motorist.packStatus.${status}`)
          return (
            <span
              className={cn(
                'text-xs font-semibold',
                disabled ? 'text-ink' : statusTone(status),
              )}
              title={blockKey ? t(blockKey) : undefined}
            >
              {label}
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
          const pack = row.original
          const status = pack.status
          const stages = packLifecycleStages(status, {
            walletReady: claimReady,
            createdAt: pack.createdAt,
          })
          const label = t(`motorist.packStatus.${status}`)
          return (
            <div className="flex justify-end">
              <LifecycleRing stages={stages} label={label} size={18} />
            </div>
          )
        },
      },
      {
        id: 'actions',
        accessorFn: (row) => row.id,
        header: () => <span className="sr-only">{t('motorist.colActions')}</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const pack = row.original
          if (!canArchivePack(pack)) return null
          return (
            <button
              type="button"
              className="text-xs font-semibold text-ink underline-offset-4 hover:underline"
              data-testid={`archive-pack-${pack.id}`}
              onClick={(e) => {
                e.stopPropagation()
                archivePack(pack.id)
              }}
            >
              {t('motorist.archive')}
            </button>
          )
        },
      },
    ],
    [archivePack, claimReady, labelCopy, profile.city, t, i18n.language],
  )

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  async function onNewAccident() {
    await start()
    navigate('/now')
  }

  function openPack(row: EvidencePack) {
    openMotoristPack({
      pack: row,
      packId: row.id,
      resume,
      navigate,
      claimReady,
      onLaterBlocked: () => showToast(t('home.laterBlocked'), 'alert'),
      onExpired: () => showToast(t('now.expiredToast'), 'alert'),
    })
  }

  function goLater() {
    if (!claimReady) {
      showToast(t('home.laterBlocked'), 'alert')
      return
    }
    navigate('/later')
  }

  function goAssist() {
    if (!claimReady) {
      showToast(t('home.assistBlocked'), 'alert')
      return
    }
    navigate('/assist')
  }

  return (
    <ShellScroll>
    <ShellListFrame className="space-y-6">
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
        <button
          type="button"
          onClick={goAssist}
          className={cn(
            'font-semibold underline-offset-4 hover:underline',
            claimReady ? 'text-ink' : 'text-ink-muted',
          )}
          data-testid="home-door-assist"
          aria-disabled={!claimReady}
        >
          {t('home.doorAssist')}
        </button>
        <span className="text-ink-muted">{t('app.notAClaim')}</span>
      </div>

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-ink md:text-2xl">
            {t('motorist.accidentsTitle')}
          </h2>
          <Button
            className="h-11 min-h-11 shrink-0 gap-2 pl-3.5 pr-4 text-sm"
            loading={starting}
            onClick={() => {
              void onNewAccident()
            }}
            data-testid="home-new-accident"
            title={t('home.doorNowHint')}
          >
            {!starting ? (
              <LabasIcon name="warning" className="h-5 w-5 shrink-0" tone="onInk" aria-hidden />
            ) : null}
            {starting ? t('now.starting') : t('home.doorNow')}
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={packs}
          emptyMessage={t('motorist.claimsEmpty')}
          getRowTestId={(row) => `sinistre-${row.id}`}
          isRowDisabled={(row) => isAccidentRowDisabled(row, claimReady)}
          onRowClick={openPack}
        />
      </section>
    </ShellListFrame>
    </ShellScroll>
  )
}
