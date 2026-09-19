import { Link, NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import { BrandMark } from '@/components/BrandLogo'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { LogoutButton } from '@/components/LogoutButton'
import { cn } from '@/lib/utils'

export const shellActiveEntry =
  'bg-ink-soft text-ink outline outline-1 outline-ink/20 font-semibold'

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
  /** Action beside avatar (e.g. settings gear). */
  avatarAction?: ReactNode
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
  avatarAction,
  search,
  nav,
  listTitle,
  list,
  toast,
  bottomDock,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-sand text-ink md:flex-row">
      <aside
        className="sticky top-0 z-20 flex w-full shrink-0 flex-col border-b border-border/50 bg-[#faf8f3] px-3 py-4 backdrop-blur-md md:h-dvh md:w-60 md:border-b-0 md:border-r"
        aria-label={navLabel}
      >
        <Link
          to={homeTo}
          className="mb-4 inline-flex items-center gap-2.5 px-1"
          aria-label="Med Assurance"
        >
          <BrandMark size="md" className="h-10 w-10" />
          <span className="font-display text-base font-extrabold leading-none text-ink sm:text-lg">
            Med Assurance
          </span>
        </Link>

        {search ? <div className="mb-3 px-0.5">{search}</div> : null}

        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">{nav}</nav>

        {list != null ? (
          <div className="mt-4 hidden min-h-0 flex-1 flex-col md:flex">
            {listTitle ? (
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {listTitle}
              </p>
            ) : null}
            <div className="labas-scroll min-h-0 flex-1 overflow-y-auto pr-1">{list}</div>
          </div>
        ) : (
          <div className="mt-4 hidden flex-1 md:block" />
        )}

        <div className="mt-3 border-t border-border/60 pt-3 md:mt-auto">
          <div className="flex items-center gap-2 px-1">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-soft outline outline-1 outline-ink/15"
              aria-hidden
              data-testid={avatarTestId}
            >
              <LabasIcon name="user" className="h-5 w-5" tone="onSand" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink" title={displayName}>
                {displayName}
              </p>
              <LogoutButton className="mt-0.5 text-xs" />
            </div>
            {avatarAction}
          </div>
        </div>
      </aside>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {toast}
        <div className="labas-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {children ?? <Outlet />}
        </div>
        {bottomDock ? (
          <div className="relative z-30 shrink-0 px-0 md:px-0">{bottomDock}</div>
        ) : null}
      </div>
    </div>
  )
}
