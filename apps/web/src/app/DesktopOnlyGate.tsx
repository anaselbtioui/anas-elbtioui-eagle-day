import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrandLogo } from '@/components/BrandLogo'
import { LabasIcon } from '@/components/LabasIcon'
import { useMediaQuery } from '@/lib/useMediaQuery'

/** Tailwind `md` — desk shell needs this width. */
export const DESKTOP_MIN_MQ = '(min-width: 768px)'

/** Full-viewport notice when the product UI is desktop-only. */
export function MobileUnavailableScreen() {
  const { t } = useTranslation()
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-[#faf8f3] px-6 py-10 text-center"
      data-testid="mobile-unavailable"
    >
      <BrandLogo size="lg" className="mb-8 drop-shadow-none" />
      <span
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-ink-soft outline outline-1 outline-ink/15"
        aria-hidden
      >
        <LabasIcon name="device" className="h-7 w-7" tone="onSand" />
      </span>
      <h1 className="font-display max-w-sm text-2xl font-bold text-ink">
        {t('app.mobileUnavailableTitle')}
      </h1>
      <p className="mt-3 max-w-sm text-base leading-relaxed text-ink-muted">
        {t('app.mobileUnavailableBody')}
      </p>
    </div>
  )
}

/** Renders children from `md` up; otherwise the mobile-not-ready screen. */
export function DesktopOnlyGate({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery(DESKTOP_MIN_MQ)
  if (!isDesktop) return <MobileUnavailableScreen />
  return children
}
