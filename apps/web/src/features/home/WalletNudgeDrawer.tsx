import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { StickyActionsProvider } from '@/components/ui/sticky-actions'
import { OnboardingWizardBody } from '@/features/onboarding/OnboardingPage'
import {
  attestationDaysRemaining,
  walletEssentialsFilled,
  walletRemainingPercent,
  type Wallet,
} from '@/services/wallet.ts'
import { cn } from '@/lib/utils'

export type WalletNudgeKind = 'empty' | 'expired' | 'expiring' | null

export { walletEssentialsFilled, walletRemainingPercent, walletClaimReady } from '@/services/wallet.ts'

export function walletNudgeKind(profile: Wallet): WalletNudgeKind {
  if (!walletEssentialsFilled(profile)) return 'empty'
  const days = attestationDaysRemaining(profile.attestationValidUntil)
  if (days !== null && days < 0) return 'expired'
  if (days !== null && days <= 45) return 'expiring'
  return null
}

/**
 * Docked bottom drawer: collapsed peek → expands into onboarding wizard.
 * Overlay only when expanded. Peek stays pinned (shell locks viewport).
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
        <div className="flex shrink-0 items-start gap-1 px-2 pt-2">
          {expanded ? (
            <button
              type="button"
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
              onClick={() => setExpanded(false)}
              aria-label={t('app.close')}
            >
              <LabasIcon name="close" className="h-5 w-5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className={cn('min-w-0 flex-1 pb-3 text-left', expanded ? 'px-1 pt-2.5' : 'px-3 pt-3')}
            onClick={() => {
              if (!expanded) setExpanded(true)
            }}
            disabled={expanded}
            data-testid="wallet-nudge-reopen"
          >
            <span
              id="wallet-nudge-title"
              className={cn(
                'block text-balance font-display font-bold leading-snug text-ink',
                expanded ? 'text-lg' : 'text-base',
              )}
            >
              {title}
            </span>
          </button>
        </div>

        {expanded ? (
          <StickyActionsProvider
            className="min-h-0 max-h-[min(70dvh,32rem)]"
            bodyClassName="px-5 pb-1"
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
