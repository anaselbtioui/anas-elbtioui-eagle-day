import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type StickyActionsCtx = {
  footerEl: HTMLElement | null
  setHasActions: (v: boolean) => void
}

const StickyActionsContext = createContext<StickyActionsCtx | null>(null)

/**
 * Scrollable body + sticky action footer.
 * Nest `StickyActions` anywhere inside for teleported footer buttons.
 */
export function StickyActionsProvider({
  children,
  className,
  bodyClassName,
  footerClassName,
  /** When false, footer sits under content instead of pinning to panel bottom. */
  growBody = true,
}: {
  children: ReactNode
  className?: string
  bodyClassName?: string
  footerClassName?: string
  growBody?: boolean
}) {
  const [footerEl, setFooterEl] = useState<HTMLElement | null>(null)
  const [hasActions, setHasActions] = useState(false)
  const ctx = useMemo(
    () => ({ footerEl, setHasActions }),
    [footerEl],
  )

  return (
    <StickyActionsContext.Provider value={ctx}>
      <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
        <div
          className={cn(
            'labas-scroll min-h-0 overflow-y-auto',
            growBody && 'flex-1',
            bodyClassName,
            /* Space before sticky footer divider — avoid flush content. */
            hasActions && (growBody ? 'pb-7' : 'pb-3'),
          )}
        >
          {children}
        </div>
        <div
          ref={setFooterEl}
          className={cn(
            'relative z-10 shrink-0 border-t border-border/60 bg-surface px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]',
            !hasActions && 'hidden border-0 p-0',
            footerClassName,
          )}
          data-sticky-actions-footer
          hidden={!hasActions}
        />
      </div>
    </StickyActionsContext.Provider>
  )
}

/** Renders in StickyActionsProvider footer; falls back to inline when no provider. */
export function StickyActions({ children }: { children: ReactNode }) {
  const ctx = useContext(StickyActionsContext)

  useLayoutEffect(() => {
    if (!ctx) return
    ctx.setHasActions(true)
    return () => ctx.setHasActions(false)
  }, [ctx])

  const row = (
    <div
      className={cn(
        'sticky-actions-row flex w-full flex-col gap-2',
        'md:flex-row md:flex-wrap md:items-stretch md:gap-3',
        'md:[&>*:not(.basis-full)]:min-w-0 md:[&>*:not(.basis-full)]:flex-1',
        !ctx && 'pt-3',
      )}
    >
      {children}
    </div>
  )

  if (!ctx) return row
  if (!ctx.footerEl) return null
  return createPortal(row, ctx.footerEl)
}
