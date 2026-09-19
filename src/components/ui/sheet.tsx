import * as Dialog from '@radix-ui/react-dialog'
import * as React from 'react'
import { LabasIcon } from '@/components/LabasIcon'
import { StickyActionsProvider } from '@/components/ui/sticky-actions'
import { cn } from '@/lib/utils'

export const Sheet = Dialog.Root
export const SheetTrigger = Dialog.Trigger
export const SheetClose = Dialog.Close

export function SheetContent({
  className,
  children,
  hideClose = false,
  /** When false, caller composes scroll/footer manually. Default: sticky-actions provider. */
  stickyActions = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & {
  hideClose?: boolean
  stickyActions?: boolean
}) {
  const body = stickyActions ? (
    <StickyActionsProvider
      className="min-h-0 flex-1"
      bodyClassName="px-5 pt-1 pb-1"
      footerClassName="px-5"
    >
      {children}
    </StickyActionsProvider>
  ) : (
    children
  )

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
      <Dialog.Content
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-[1.25rem] border border-border bg-surface p-0 shadow-[0_-8px_40px_rgba(16,40,96,0.12)] outline-none',
          className,
        )}
        {...props}
      >
        <div className="relative flex shrink-0 items-center justify-center px-12 pb-2 pt-3">
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
          {hideClose ? null : (
            <Dialog.Close className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-muted transition-colors hover:bg-sand-deep active:scale-[0.96]">
              <LabasIcon name="close" className="h-5 w-5" aria-hidden />
              <span className="sr-only">Fermer</span>
            </Dialog.Close>
          )}
        </div>
        {body}
      </Dialog.Content>
    </Dialog.Portal>
  )
}

/** Scroll region when `stickyActions={false}` on SheetContent. */
export function SheetBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('labas-scroll min-h-0 flex-1 overflow-y-auto px-5 pt-1', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** Fixed action bar when `stickyActions={false}` on SheetContent. */
export function SheetFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'shrink-0 border-t border-border/60 bg-surface px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function SheetTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={cn('font-display pr-10 text-2xl font-bold text-ink', className)}
      {...props}
    />
  )
}

export function SheetDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Description>) {
  return (
    <Dialog.Description className={cn('mt-1 text-base text-ink-muted', className)} {...props} />
  )
}
