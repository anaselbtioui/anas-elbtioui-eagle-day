import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useSessionStore } from '@/store/session'
import { cn } from '@/lib/utils'

type LogoutButtonProps = {
  className?: string
}

export function LogoutConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)

  function confirmLogout() {
    signOut()
    onOpenChange(false)
    navigate('/', { replace: true })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'labas-dialog-panel fixed left-1/2 top-1/2 z-50 w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'rounded-[var(--radius-labas)] border border-border bg-surface p-5 shadow-[0_12px_40px_-12px_rgba(16,40,96,0.28)]',
            'outline-none',
          )}
          data-testid="logout-confirm"
        >
          <Dialog.Title className="font-display text-xl font-bold text-ink">
            {t('auth.logoutConfirmTitle')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-base text-ink-muted">
            {t('auth.logoutConfirmBody')}
          </Dialog.Description>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t('app.close')}
            </Button>
            <Button
              type="button"
              variant="alert"
              className="flex-1"
              data-testid="logout-confirm-yes"
              onClick={confirmLogout}
            >
              {t('auth.logout')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={cn(
          'text-sm font-medium text-ink-muted underline-offset-4 hover:underline',
          className,
        )}
        data-testid="logout"
        onClick={() => setOpen(true)}
      >
        {t('auth.logout')}
      </button>
      <LogoutConfirmDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
