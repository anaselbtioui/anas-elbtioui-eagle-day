import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { LogoutConfirmDialog } from '@/components/LogoutButton'
import { cn } from '@/lib/utils'

type AccountMenuProps = {
  displayName: string
  avatarTestId: string
  onSettings: () => void
}

const menuItemClass =
  'flex min-h-10 w-full items-center gap-2.5 rounded-[calc(var(--radius-labas)-2px)] px-2.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-sand-deep/80'

/** Avatar row opens settings and log out. Same control on both shells. */
export function AccountMenu({ displayName, avatarTestId, onSettings }: AccountMenuProps) {
  const { t } = useTranslation()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-labas)] px-1 text-left transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep/80 active:scale-[0.96]"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        data-testid={avatarTestId}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-soft outline outline-1 outline-ink/15"
          aria-hidden
        >
          <LabasIcon name="user" className="h-5 w-5" tone="onSand" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink" title={displayName}>
          {displayName}
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          data-testid="account-menu"
          className="absolute bottom-full left-0 z-30 mb-2 w-full min-w-44 rounded-[var(--radius-labas)] border border-border bg-surface p-1.5 shadow-[0_12px_40px_-12px_rgba(16,40,96,0.28)]"
        >
          <button
            type="button"
            role="menuitem"
            className={menuItemClass}
            data-testid="account-menu-settings"
            onClick={() => {
              setOpen(false)
              onSettings()
            }}
          >
            <LabasIcon name="settings" className="h-4 w-4 shrink-0" tone="onSand" aria-hidden />
            {t('motorist.settingsTitle')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={cn(menuItemClass)}
            data-testid="logout"
            onClick={() => {
              setOpen(false)
              setConfirmLogout(true)
            }}
          >
            <LabasIcon name="logout" className="h-4 w-4 shrink-0" tone="onSand" aria-hidden />
            {t('auth.logout')}
          </button>
        </div>
      ) : null}

      <LogoutConfirmDialog open={confirmLogout} onOpenChange={setConfirmLogout} />
    </div>
  )
}
