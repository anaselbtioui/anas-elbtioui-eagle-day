import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { StickyActions, StickyActionsProvider } from '@/components/ui/sticky-actions'
import { cn } from '@/lib/utils'

export type SettingsNavItem = {
  id: string
  icon: LabasIconName
  label: string
}

type SettingsModalShellProps = {
  open: boolean
  title: string
  testId: string
  categories: SettingsNavItem[]
  category: string
  onCategoryChange: (id: string) => void
  onRequestClose: () => void
  /** When true, prevent dismiss while dirty / discard open. */
  blockDismiss: boolean
  onBlockedDismiss: () => void
  showSaveBar: boolean
  canSave: boolean
  changeCount: number
  persistBusy: boolean
  onSave: () => void
  children: ReactNode
}

/** Shared settings layout: category sidebar + scroll body + optional sticky Save. */
export function SettingsModalShell({
  open,
  title,
  testId,
  categories,
  category,
  onCategoryChange,
  onRequestClose,
  blockDismiss,
  onBlockedDismiss,
  showSaveBar,
  canSave,
  changeCount,
  persistBusy,
  onSave,
  children,
}: SettingsModalShellProps) {
  const { t } = useTranslation()

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) return
        onRequestClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'labas-dialog-panel fixed left-1/2 top-1/2 z-50 flex h-[min(36rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2',
            'overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(16,40,96,0.45)] outline-none',
          )}
          data-testid={testId}
          onEscapeKeyDown={(event) => {
            if (blockDismiss) {
              event.preventDefault()
              onBlockedDismiss()
            }
          }}
          onPointerDownOutside={(event) => {
            if (blockDismiss) {
              event.preventDefault()
              onBlockedDismiss()
            }
          }}
          onInteractOutside={(event) => {
            if (blockDismiss) event.preventDefault()
          }}
        >
          <aside className="flex w-[14.5rem] shrink-0 flex-col border-r border-border/70 bg-[#faf8f3]">
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-3">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
                aria-label={t('app.close')}
                onClick={onRequestClose}
              >
                <LabasIcon name="close" className="h-5 w-5" aria-hidden />
              </button>
              <Dialog.Title className="font-display text-sm font-bold text-ink">{title}</Dialog.Title>
            </div>
            <nav className="labas-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onCategoryChange(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[var(--radius-labas)] px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                    category === item.id
                      ? 'bg-ink-soft text-ink outline outline-1 outline-ink/20'
                      : 'text-ink-muted hover:bg-sand-deep/80 hover:text-ink',
                  )}
                  data-testid={`settings-cat-${item.id}`}
                >
                  <LabasIcon name={item.icon} className="h-5 w-5 shrink-0" tone="onSand" aria-hidden />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-sand/30">
            <StickyActionsProvider
              className="min-h-0 flex-1"
              bodyClassName="p-5"
              footerClassName="border-border/60 bg-sand/30 px-5"
            >
              {children}
              {showSaveBar ? (
                <StickyActions>
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!canSave || persistBusy}
                    loading={persistBusy}
                    data-testid="settings-save"
                    onClick={onSave}
                  >
                    {changeCount > 0
                      ? t('app.saveChanges', { count: changeCount })
                      : t('app.save')}
                  </Button>
                </StickyActions>
              ) : null}
            </StickyActionsProvider>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
