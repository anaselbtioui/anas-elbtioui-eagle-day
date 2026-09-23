import { Link, NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AccountMenu } from '@/components/AccountMenu'
import { BrandMark } from '@/components/BrandLogo'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { cn } from '@/lib/utils'

export const shellActiveEntry =
  'bg-ink-soft text-ink ring-1 ring-inset ring-ink/20 font-semibold'

/** Scrollable main pane for list/detail pages (wizards use StickyActionsProvider instead). */
export function ShellScroll({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('labas-scroll min-h-0 flex-1 overflow-y-auto', className)}>{children}</div>
  )
}

/** Shared width/rhythm for automobiliste + courtier list pages (tables align). */
export function ShellListFrame({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('w-full', className)}>{children}</div>
}

export function ShellNavLink({
  to,
  end,
  icon,
  label,
  testId,
}: {
  to: string
  end?: boolean
  icon: LabasIconName
  label: string
  testId: string
}) {
  return (
    <NavLink to={to} end={end} data-testid={testId}>
      {({ isActive }) => (
        <span
          className={cn(
            'flex items-center gap-3 rounded-[var(--radius-labas)] px-3 py-2.5 text-sm transition-colors',
            isActive
              ? shellActiveEntry
              : 'font-semibold text-ink-muted hover:bg-sand-deep/80 hover:text-ink',
          )}
        >
          <LabasIcon name={icon} className="h-5 w-5 shrink-0" tone="onSand" aria-hidden />
          {label}
        </span>
      )}
    </NavLink>
  )
}

type AppShellProps = {
  homeTo: string
  navLabel: string
  displayName: string
  avatarTestId: string
  /** Settings entry in the account menu. */
  onSettings: () => void
  /** Primary CTA under logo (e.g. motorist “I had an accident”). */
  sidebarPrimary?: ReactNode
  search?: ReactNode
  nav: ReactNode
  listTitle?: string
  list?: ReactNode
  toast?: ReactNode
  /** Docked chrome under main scroll (e.g. collapsed bottom drawer). */
  bottomDock?: ReactNode
  children?: ReactNode
}

/** Shared sidebar chrome for automobiliste + courtier — same shell, different slots. */
export function AppShell({
  homeTo,
  navLabel,
  displayName,
  avatarTestId,
  onSettings,
  sidebarPrimary,
  search,
  nav,
  listTitle,
  list,
  toast,
  bottomDock,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-transparent text-ink md:flex-row">
      <aside
        className="z-20 flex w-full shrink-0 flex-col border-b border-border/50 bg-[#faf8f3] px-3 py-4 backdrop-blur-md md:h-full md:w-60 md:border-b-0 md:border-r"
        aria-label={navLabel}
      >
        <Link
          to={homeTo}
          className="mb-3 inline-flex items-center gap-2.5 px-1"
          aria-label="Med Assurance"
        >
          <BrandMark size="lg" className="h-14 w-14" />
          <span className="font-display text-base font-extrabold leading-none text-ink sm:text-lg">
            Med Assurance
          </span>
        </Link>

        {sidebarPrimary ? <div className="mb-3 px-0.5">{sidebarPrimary}</div> : null}

        {search ? <div className="mb-3 px-0.5">{search}</div> : null}

        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">{nav}</nav>

        {list != null ? (
          <div className="mt-4 hidden min-h-0 flex-1 flex-col md:flex">
            {listTitle ? (
              <p className="mb-2 px-3 text-xs font-semibold text-ink-muted">
                {listTitle}
              </p>
            ) : null}
            <div className="labas-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1">
              {list}
            </div>
          </div>
        ) : (
          <div className="mt-4 hidden flex-1 md:block" />
        )}

        <div className="mt-3 border-t border-border/60 pt-3 md:mt-auto">
          <AccountMenu
            displayName={displayName}
            avatarTestId={avatarTestId}
            onSettings={onSettings}
          />
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {toast}
        {/* Height-locked pane so StickyActions footers pin to bottom; pages scroll inside. */}
        <div className="flex min-h-0 flex-1 flex-col px-5 py-6 md:px-8 md:py-8">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {children ?? <Outlet />}
          </div>
        </div>
        {bottomDock ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40">
            <div className="pointer-events-auto">{bottomDock}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
