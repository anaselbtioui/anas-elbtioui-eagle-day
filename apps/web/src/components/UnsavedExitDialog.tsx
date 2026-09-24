import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UnsavedExitDialogProps = {
  open: boolean
  onStay: () => void
  onDiscard: () => void
}

/** Blocks leaving a form while edits are still unsaved. */
export function UnsavedExitDialog({ open, onStay, onDiscard }: UnsavedExitDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-[80] bg-ink/45" />
        <Dialog.Content
          className={cn(
            'labas-dialog-panel fixed left-1/2 top-1/2 z-[81] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--radius-labas)] border border-border bg-surface p-5 shadow-[0_12px_40px_-12px_rgba(16,40,96,0.28)]',
            'outline-none',
          )}
          data-testid="settings-unsaved"
        >
          <Dialog.Title className="font-display text-xl font-bold text-ink">
            {t('motorist.unsavedTitle')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-base text-ink-muted">
            {t('motorist.unsavedBody')}
          </Dialog.Description>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              data-testid="settings-unsaved-stay"
              onClick={onStay}
            >
              {t('motorist.unsavedStay')}
            </Button>
            <Button
              type="button"
              variant="alert"
              className="flex-1"
              data-testid="settings-unsaved-discard"
              onClick={onDiscard}
            >
              {t('motorist.unsavedDiscard')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
