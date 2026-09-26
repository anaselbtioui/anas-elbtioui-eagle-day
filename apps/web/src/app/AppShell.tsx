import { Link, NavLink, Outlet } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { AccountMenu } from '@/components/AccountMenu'
import { BrandMark } from '@/components/BrandLogo'
import {
  CommandPalette,
  type CommandPaletteItem,
} from '@/components/CommandPalette'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

export const shellActiveEntry =
  'bg-ink-soft text-ink ring-1 ring-inset ring-ink/20 font-semibold'

/** Fills main pane. No outer page scroll — table / body scrolls inside. */
export function ShellFill({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      {children}
    </div>
  )
}

/** Scrollable main pane for long detail / wizard-adjacent pages. */
export function ShellScroll({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <ScrollArea
      orientation="vertical"
      className={cn('min-h-0 flex-1', className)}
    >
      {children}
    </ScrollArea>
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
  return <div className={cn('flex min-h-0 w-full flex-1 flex-col', className)}>{children}</div>
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

export type ShellCommandSearch = {
  title: string
  placeholder: string
  emptyLabel: string
  query: string
  onQueryChange: (query: string) => void
  items: CommandPaletteItem[]
  inputTestId?: string
}

type AppShellProps = {
  homeTo: string
  navLabel: string
  displayName: string
  avatarUrl?: string
  avatarLoading?: boolean
  nameLoading?: boolean
  avatarTestId: string
  /** Settings entry in the account menu. */
  onSettings: () => void
  /** Primary CTA under logo (e.g. motorist “I had an accident”). */
  sidebarPrimary?: ReactNode
  /** Global Cmd/Ctrl+K command palette. */
  commandSearch?: ShellCommandSearch
  /** Accessible name for the header search toggle. */
  searchLabel?: string
  nav: ReactNode
  listTitle?: ReactNode
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
  avatarUrl,
  avatarLoading,
  nameLoading,
  avatarTestId,
  onSettings,
  sidebarPrimary,
  commandSearch,
  searchLabel = 'Search',
  nav,
  listTitle,
  list,
  toast,
  bottomDock,
  children,
}: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    if (!commandSearch) return
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
      const target = e.target
      if (
        target instanceof HTMLElement &&
        target.closest('[role="dialog"], [data-command-palette-ignore]')
      ) {
        // Still allow Cmd+K to toggle when focus is outside our palette.
      }
      e.preventDefault()
      setSearchOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandSearch])

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-transparent text-ink md:flex-row">
      <aside
        className="z-20 flex w-full shrink-0 flex-col border-b border-border/50 bg-[#faf8f3] px-3 py-4 backdrop-blur-md md:h-full md:w-60 md:border-b-0 md:border-r"
        aria-label={navLabel}
      >
        <div className="mb-3 flex items-center gap-1.5 px-1">
          <Link
            to={homeTo}
            className="inline-flex shrink-0 items-center"
            aria-label="Med Assurance"
          >
            <BrandMark size="lg" className="h-14 w-14" />
          </Link>
          {commandSearch ? (
            <button
              type="button"
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-full px-2.5 text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep hover:text-ink active:scale-[0.96]"
              aria-label={searchLabel}
              data-testid="shell-search-toggle"
              onClick={() => setSearchOpen(true)}
            >
              <LabasIcon name="search" className="h-5 w-5" tone="onSand" aria-hidden />
              <kbd className="hidden rounded-md border border-border/80 bg-surface/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted sm:inline">
                {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
                  ? '⌘K'
                  : 'Ctrl+K'}
              </kbd>
            </button>
          ) : null}
        </div>

        {sidebarPrimary ? <div className="mb-3 px-0.5">{sidebarPrimary}</div> : null}

        <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">{nav}</nav>

        {list != null ? (
          <div className="mt-4 hidden min-h-0 flex-1 flex-col md:flex">
            {listTitle ? (
              <div className="mb-2 px-3 text-xs font-semibold text-ink-muted">
                {listTitle}
              </div>
            ) : null}
            <ScrollArea
              orientation="vertical"
              className="min-h-0 flex-1"
              viewportClassName="p-1"
            >
              {list}
            </ScrollArea>
          </div>
        ) : (
          <div className="mt-4 hidden flex-1 md:block" />
        )}

        <div className="mt-3 border-t border-border/60 pt-3 md:mt-auto">
          <AccountMenu
            displayName={displayName}
            avatarUrl={avatarUrl}
            avatarLoading={avatarLoading}
            nameLoading={nameLoading}
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

      {commandSearch ? (
        <CommandPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          query={commandSearch.query}
          onQueryChange={commandSearch.onQueryChange}
          items={commandSearch.items}
          placeholder={commandSearch.placeholder}
          emptyLabel={commandSearch.emptyLabel}
          title={commandSearch.title}
          inputTestId={commandSearch.inputTestId}
        />
      ) : null}
    </div>
  )
}
