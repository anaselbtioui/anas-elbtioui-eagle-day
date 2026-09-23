import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LifecycleRing } from '@/components/LifecycleRing'
import { canArchivePack, canCancelPack, type EvidencePack } from '@/domain/evidence'
import type { LifecycleStage } from '@/domain/lifecycle.ts'
import { cn } from '@/lib/utils'

/** Active stage, else cancelled (terminal), else last done — the “concerned” slice. */
export function concernedLifecycleStages(stages: LifecycleStage[]): LifecycleStage[] {
  const active = stages.filter((s) => s.state === 'active')
  if (active.length > 0) return active
  const cancelled = stages.filter((s) => s.state === 'cancelled')
  if (cancelled.length > 0) return cancelled
  const done = stages.filter((s) => s.state === 'done')
  if (done.length > 0) return [done[done.length - 1]!]
  return stages.slice(0, 1)
}

type PendingAction = 'cancel' | 'archive'

type RecentPackRowProps = {
  pack: EvidencePack
  stages: LifecycleStage[]
  title: string
  refLabel: string
  relative: string
  absoluteTime: string
  active: boolean
  declareBlocked: boolean
  activeClassName: string
  idleClassName: string
  onOpen: () => void
  onArchive: () => void
  onCancel: () => void
}

export function RecentPackRow({
  pack,
  stages,
  title,
  refLabel,
  relative,
  absoluteTime,
  active,
  declareBlocked,
  activeClassName,
  idleClassName,
  onOpen,
  onArchive,
  onCancel,
}: RecentPackRowProps) {
  const { t } = useTranslation()
  const statusLabel = t(`motorist.packStatus.${pack.status}`)
  const archivable = canArchivePack(pack)
  const cancellable = canCancelPack(pack)
  const hasActions = archivable || cancellable
  const tipStages = concernedLifecycleStages(stages)
  const [pending, setPending] = useState<PendingAction | null>(null)

  function confirmPending() {
    if (pending === 'cancel') onCancel()
    if (pending === 'archive') onArchive()
    setPending(null)
  }

  return (
    <li className="group/row relative">
      <button
        type="button"
        disabled={declareBlocked}
        onClick={onOpen}
        data-fluid-item
        {...(declareBlocked ? { 'data-fluid-disabled': '' } : {})}
        className={cn(
          'relative z-[1] flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-labas)] px-3 py-2.5 text-left text-sm leading-none',
          declareBlocked && 'cursor-not-allowed text-ink-muted opacity-45',
          !declareBlocked && (active ? activeClassName : idleClassName),
        )}
        data-testid={`nav-pack-${pack.id}`}
      >
        <LifecycleRing
          stages={stages}
          tipStages={tipStages}
          label={statusLabel}
          size={16}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold leading-normal">
          {title}
        </span>
        <span
          className={cn(
            'shrink-0 self-center tabular-nums text-[0.6875rem] font-medium leading-none text-ink-muted/80 transition-opacity duration-150',
            hasActions &&
              'group-hover/row:opacity-0 group-focus-within/row:opacity-0 [@media(hover:none)]:opacity-0',
          )}
          title={absoluteTime}
        >
          {relative}
        </span>
      </button>

      {hasActions ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-0 right-1 z-[2] flex items-center gap-0.5 opacity-0 transition-opacity duration-150 ease-out',
            'group-hover/row:pointer-events-auto group-hover/row:opacity-100',
            'group-focus-within/row:pointer-events-auto group-focus-within/row:opacity-100',
            '[@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100',
          )}
        >
          {cancellable ? (
            <button
              type="button"
              className="flex h-8 items-center justify-center rounded-[calc(var(--radius-labas)-2px)] px-2 text-[0.6875rem] font-semibold text-ink-muted transition-[transform,background-color,color] duration-150 ease-out hover:bg-surface hover:text-alert active:scale-[0.96]"
              title={t('motorist.cancel')}
              aria-label={`${t('motorist.cancel')} — ${refLabel}`}
              data-testid={`nav-pack-cancel-${pack.id}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPending('cancel')
              }}
            >
              {t('motorist.cancel')}
            </button>
          ) : null}
          {archivable ? (
            <button
              type="button"
              className="flex h-8 items-center justify-center rounded-[calc(var(--radius-labas)-2px)] px-2 text-[0.6875rem] font-semibold text-ink-muted transition-[transform,background-color,color] duration-150 ease-out hover:bg-surface hover:text-ink active:scale-[0.96]"
              title={t('motorist.archive')}
              aria-label={`${t('motorist.archive')} — ${refLabel}`}
              data-testid={`nav-pack-archive-${pack.id}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPending('archive')
              }}
            >
              {t('motorist.archive')}
            </button>
          ) : null}
        </div>
      ) : null}

      <Dialog.Root
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="labas-overlay fixed inset-0 z-50 bg-ink/40" />
          <Dialog.Content
            className={cn(
              'labas-dialog-panel fixed left-1/2 top-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
              'rounded-[var(--radius-labas)] border border-border bg-surface p-5 shadow-[0_12px_40px_-12px_rgba(16,40,96,0.28)]',
              'outline-none',
            )}
            data-testid={`nav-pack-confirm-${pending ?? 'none'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <Dialog.Title className="font-display text-xl font-bold text-ink">
              {pending === 'archive'
                ? t('motorist.archiveConfirmTitle')
                : t('motorist.cancelConfirmTitle')}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-base text-ink-muted">
              {pending === 'archive'
                ? t('motorist.archiveConfirmBody')
                : t('motorist.cancelConfirmBody')}
            </Dialog.Description>
            <p className="mt-2 truncate text-sm font-semibold text-ink" title={refLabel}>
              {title}
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setPending(null)}
              >
                {t('app.close')}
              </Button>
              <Button
                type="button"
                variant={pending === 'cancel' ? 'alert' : 'default'}
                className="flex-1"
                data-testid={`nav-pack-confirm-yes-${pending ?? 'none'}`}
                onClick={confirmPending}
              >
                {pending === 'archive' ? t('motorist.archive') : t('motorist.cancel')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </li>
  )
}
