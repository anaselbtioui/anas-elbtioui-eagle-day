import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ReleaseNote } from '@/releases/catalog.ts'
import { cn } from '@/lib/utils'

type ReleaseNotesDialogProps = {
  release: ReleaseNote
  open: boolean
  onDismiss: () => void
}

/** One-shot “what’s new” after a significant ship. */
export function ReleaseNotesDialog({ release, open, onDismiss }: ReleaseNotesDialogProps) {
  const { t, i18n } = useTranslation()
  const dateLabel = new Intl.DateTimeFormat(
    i18n.language.toLowerCase().startsWith('en') ? 'en-GB' : 'fr-MA',
    { dateStyle: 'medium' },
  ).format(new Date(`${release.date}T12:00:00`))

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-[80] bg-ink/45" />
        <Dialog.Content
          className={cn(
            'labas-dialog-panel fixed left-1/2 top-1/2 z-[81] w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--radius-labas)] border border-border bg-surface p-5 shadow-[0_12px_40px_-12px_rgba(16,40,96,0.28)]',
            'outline-none',
          )}
          data-testid="release-notes"
          aria-describedby="release-notes-body"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {t('releases.badge')} · {dateLabel}
          </p>
          <Dialog.Title className="mt-1.5 font-display text-xl font-bold text-ink">
            {t(release.titleKey)}
          </Dialog.Title>
          <Dialog.Description id="release-notes-body" className="sr-only">
            {t('releases.hint')}
          </Dialog.Description>
          <ul className="mt-4 space-y-2">
            {release.bodyKeys.map((key) => (
              <li
                key={key}
                className="flex gap-2 text-sm leading-snug text-ink"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-moss"
                  aria-hidden
                />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Button
              type="button"
              className="w-full"
              data-testid="release-notes-dismiss"
              onClick={onDismiss}
            >
              {t('releases.gotIt')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
