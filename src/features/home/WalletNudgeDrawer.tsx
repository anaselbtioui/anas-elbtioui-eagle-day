import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { StickyActionsProvider } from '@/components/ui/sticky-actions'
import { OnboardingWizardBody } from '@/features/onboarding/OnboardingPage'
import { attestationDaysRemaining, type Wallet } from '@/services/wallet.ts'
import { cn } from '@/lib/utils'

export type WalletNudgeKind = 'empty' | 'expired' | 'expiring' | null

const ESSENTIAL_FIELDS = [
  'name',
  'phone',
  'plate',
  'vehicle',
  'insurer',
  'city',
] as const satisfies ReadonlyArray<keyof Wallet>

/** Share of essentials still missing (0–100). */
export function walletRemainingPercent(profile: Wallet): number {
  const filled = ESSENTIAL_FIELDS.filter((key) => String(profile[key] ?? '').trim()).length
  const done = filled / ESSENTIAL_FIELDS.length
  return Math.max(0, Math.round((1 - done) * 100))
}

export function walletEssentialsFilled(profile: Wallet): boolean {
  return walletRemainingPercent(profile) === 0
}

export function walletNudgeKind(profile: Wallet): WalletNudgeKind {
  if (!walletEssentialsFilled(profile)) return 'empty'
  const days = attestationDaysRemaining(profile.attestationValidUntil)
  if (days !== null && days < 0) return 'expired'
  if (days !== null && days <= 45) return 'expiring'
  return null
}

/**
 * Docked bottom drawer: collapsed peek → expands into onboarding wizard.
 * One ergonomic title. No overlay. No second sheet.
 */
export function WalletNudgeDrawer({ profile }: { profile: Wallet }) {
  const { t } = useTranslation()
  const kind = walletNudgeKind(profile)
  const [expanded, setExpanded] = useState(false)

  const remainingPct = useMemo(() => walletRemainingPercent(profile), [profile])

  if (!kind) return null

  const title =
    kind === 'empty'
      ? t('motorist.walletNudgeRemaining', { pct: remainingPct })
      : kind === 'expired'
        ? t('motorist.walletNudgeExpired')
        : t('motorist.walletNudgeExpiring')

  return (
    <div className="relative z-50 flex w-full justify-center px-4 md:px-6">
      <div
        className={cn(
          'relative w-full max-w-md border border-b-0 border-border bg-surface shadow-[0_-8px_40px_rgba(16,40,96,0.12)]',
          'rounded-t-[1.25rem]',
          expanded && 'flex max-h-[min(88dvh,40rem)] flex-col',
        )}
        data-testid="wallet-nudge-drawer"
        role="dialog"
        aria-expanded={expanded}
        aria-labelledby="wallet-nudge-title"
      >
        <div className="relative flex shrink-0 items-center justify-center px-12 pb-1 pt-3">
          <button
            type="button"
            className="absolute inset-x-0 top-0 flex justify-center pb-1 pt-3"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? t('app.close') : t('motorist.walletNudgeOpen')}
            data-testid="wallet-nudge-reopen"
          >
            <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
          </button>
          {expanded ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-ink-muted hover:bg-sand-deep"
              onClick={() => setExpanded(false)}
              aria-label={t('app.close')}
            >
              <LabasIcon name="close" className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="w-full px-5 pb-3 text-left"
          onClick={() => {
            if (!expanded) setExpanded(true)
          }}
          disabled={expanded}
        >
          <span
            id="wallet-nudge-title"
            className={cn(
              'block font-display font-bold leading-snug text-ink',
              expanded ? 'pr-8 text-lg' : 'text-base',
            )}
          >
            {title}
          </span>
        </button>

        {expanded ? (
          <StickyActionsProvider
            className="min-h-0 max-h-[min(70dvh,32rem)]"
            bodyClassName="px-5"
            footerClassName="px-5"
          >
            <OnboardingWizardBody
              onClose={() => setExpanded(false)}
              onFinished={() => setExpanded(false)}
              showStepTitle={false}
            />
          </StickyActionsProvider>
        ) : null}
      </div>
    </div>
  )
}
