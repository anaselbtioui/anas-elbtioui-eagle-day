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
}: {
  children: ReactNode
  className?: string
  bodyClassName?: string
  footerClassName?: string
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
            'labas-scroll min-h-0 flex-1 overflow-y-auto',
            bodyClassName,
            /* Space before sticky footer divider — avoid flush content. */
            hasActions && 'pb-5',
          )}
        >
          {children}
        </div>
        <div
          ref={setFooterEl}
          className={cn(
            'shrink-0 border-t border-border/60 bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
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

  if (!ctx) {
    return <div className="space-y-2 pt-3">{children}</div>
  }
  if (!ctx.footerEl) return null
  return createPortal(children, ctx.footerEl)
}
