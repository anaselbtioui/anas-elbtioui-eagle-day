import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { BrandMark } from '@/components/BrandLogo'
import { cn } from '@/lib/utils'

export function MobileShell({
  children,
  title,
  backTo,
  alert,
  footer,
  hideHeader = false,
  wide = false,
}: {
  children: ReactNode
  title?: string
  backTo?: string
  alert?: boolean
  footer?: ReactNode
  /** Brand already on page (e.g. onboarding hero) — skip chrome header. */
  hideHeader?: boolean
  /** Desktop: expand past phone column (home hub). */
  wide?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'mx-auto flex min-h-dvh w-full flex-col',
        wide ? 'max-w-md md:max-w-5xl' : 'max-w-md md:max-w-lg',
        alert ? 'bg-alert-soft/85' : 'bg-transparent',
      )}
    >
      {hideHeader ? null : (
        <header
          className={cn(
            'sticky top-0 z-10 flex items-center gap-3 border-b px-4 py-3 backdrop-blur-md',
            alert ? 'border-alert/20 bg-alert-soft/90' : 'border-border/60 bg-sand/75',
          )}
        >
          {backTo ? (
            <Link to={backTo} className="min-h-12 min-w-12 content-center text-sm font-medium">
              ← {t('app.back')}
            </Link>
          ) : (
            <Link to="/" className="inline-flex items-center gap-2" aria-label="Med Assurance">
              <BrandMark size="sm" />
              <span className="font-display text-lg font-extrabold text-ink">Med Assurance</span>
            </Link>
          )}
          {title ? (
            <h1 className="font-display flex-1 text-base font-bold text-ink">{title}</h1>
          ) : null}
        </header>
      )}
      <main className={cn('flex-1 px-4 py-5', wide && 'md:px-8 md:py-8')}>{children}</main>
      {footer ? (
        <footer className="sticky bottom-0 border-t border-border/60 bg-sand/80 p-4 backdrop-blur-md">
          {footer}
        </footer>
      ) : null}
    </div>
  )
}

export function QuestionPage({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {hint ? <p className="mt-2 text-base text-ink-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}
