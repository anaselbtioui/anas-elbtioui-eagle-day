import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { StickyActionsProvider } from '@/components/ui/sticky-actions'
import { cn } from '@/lib/utils'

/** Desk-embedded wizard chrome (replaces MobileShell inside MotoristShell). */
export function WizardFrame({
  title,
  backTo = '/',
  alert = false,
  children,
  className,
}: {
  title: string
  backTo?: string
  alert?: boolean
  children: ReactNode
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-2xl flex-col',
        alert && 'rounded-[var(--radius-labas)] bg-alert-soft/40 p-4 md:p-5',
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-3">
        <Link
          to={backTo}
          className="min-h-10 shrink-0 content-center text-sm font-medium text-ink-muted hover:text-ink"
        >
          ← {t('app.back')}
        </Link>
        <h1 className="font-display truncate text-xl font-bold text-ink md:text-2xl">{title}</h1>
      </div>
      <StickyActionsProvider
        className="min-h-0 max-h-[calc(100dvh-8.5rem)]"
        bodyClassName="pr-1"
        footerClassName="px-0"
      >
        {children}
      </StickyActionsProvider>
    </div>
  )
}

export function WizardSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-5 pb-2">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {hint ? <p className="mt-2 text-base text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
