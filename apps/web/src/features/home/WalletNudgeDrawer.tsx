import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { Progress } from '@/components/ui/progress'
import { StickyActionsProvider } from '@/components/ui/sticky-actions'
import {
  ONBOARDING_STEPS,
  OnboardingWizardBody,
} from '@/features/onboarding/OnboardingPage'
import {
  attestationDaysRemaining,
  walletEssentialsFilled,
  walletFullyComplete,
  walletIncompleteSteps,
  walletRemainingPercent,
  type Wallet,
} from '@/services/wallet.ts'
import { cn } from '@/lib/utils'

export type WalletNudgeKind = 'empty' | 'expired' | 'expiring' | 'complete' | null

export {
  walletEssentialsFilled,
  walletRemainingPercent,
  walletClaimReady,
  walletFullyComplete,
} from '@/services/wallet.ts'

function dismissKey(motoristId: string) {
  return `labas-wallet-complete-dismissed:${motoristId || 'anon'}`
}

export function walletNudgeKind(profile: Wallet, completeDismissed = false): WalletNudgeKind {
  if (!walletEssentialsFilled(profile) || walletRemainingPercent(profile) > 0) return 'empty'
  const days = attestationDaysRemaining(profile.attestationValidUntil)
  if (days !== null && days < 0) return 'expired'
  if (days !== null && days <= 45) return 'expiring'
  if (walletFullyComplete(profile) && !completeDismissed) return 'complete'
  return null
}

/**
 * Docked bottom drawer: collapsed peek → expands into onboarding wizard.
 * Incomplete: resume only gap steps with highlighted inputs.
 * Complete: ending state peek (dismissible).
 */
export function WalletNudgeDrawer({ profile }: { profile: Wallet }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [completeDismissed, setCompleteDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey(profile.motoristId)) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      setCompleteDismissed(sessionStorage.getItem(dismissKey(profile.motoristId)) === '1')
    } catch {
      setCompleteDismissed(false)
    }
  }, [profile.motoristId])

  const kind = walletNudgeKind(profile, completeDismissed)

  const remainingPct = useMemo(() => walletRemainingPercent(profile), [profile])
  const gapCount = useMemo(() => walletIncompleteSteps(profile).length, [profile])
  const stepPct = useMemo(() => {
    if (kind === 'complete') return 100
    const gaps = walletIncompleteSteps(profile)
    if (gaps.length === 0) return 100
    const filledish = ONBOARDING_STEPS.length - gaps.length
    return Math.min(100, Math.round((filledish / ONBOARDING_STEPS.length) * 100))
  }, [profile, kind])

  if (!kind) return null

  function dismissComplete() {
    try {
      sessionStorage.setItem(dismissKey(profile.motoristId), '1')
    } catch {
      /* ignore */
    }
    setCompleteDismissed(true)
    setExpanded(false)
  }

  const title =
    kind === 'empty'
      ? t('motorist.walletNudgeRemaining', { pct: remainingPct })
      : kind === 'expired'
        ? t('motorist.walletNudgeExpired')
        : kind === 'expiring'
          ? t('motorist.walletNudgeExpiring')
          : t('motorist.walletNudgeComplete')

  const subtitle =
    kind === 'empty' && gapCount > 0
      ? t('motorist.walletNudgeGaps', { count: gapCount })
      : kind === 'complete'
        ? t('motorist.walletNudgeCompleteHint')
        : null

  return (
    <div className="relative z-50 flex w-full justify-center px-4 md:px-8">
      <div
        className={cn(
          'relative w-full max-w-lg border border-b-0 border-border bg-surface shadow-[0_-8px_40px_rgba(16,40,96,0.12)]',
          'rounded-t-[1.25rem]',
          expanded && kind !== 'complete' && 'flex max-h-[min(90dvh,44rem)] flex-col',
          kind === 'complete' && 'border-moss/30 bg-moss/5',
        )}
        data-testid="wallet-nudge-drawer"
        data-wallet-nudge={kind}
        role="dialog"
        aria-expanded={expanded}
        aria-labelledby="wallet-nudge-title"
      >
        <div className="relative shrink-0">
          {expanded && kind !== 'complete' ? (
            <div className="flex justify-start px-2 pt-2">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
                onClick={() => setExpanded(false)}
                aria-label={t('app.close')}
              >
                <LabasIcon name="close" className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null}
          <div
            className={cn(
              'flex w-full items-start gap-3 text-left',
              expanded && kind !== 'complete' ? 'px-5 pb-4 pt-1' : 'px-5 pb-4 pt-4',
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                if (kind === 'complete') return
                if (!expanded) setExpanded(true)
              }}
              disabled={expanded || kind === 'complete'}
              data-testid="wallet-nudge-reopen"
            >
              <span
                id="wallet-nudge-title"
                className={cn(
                  'block text-balance font-display font-bold leading-snug',
                  kind === 'complete' ? 'text-moss' : 'text-ink',
                  expanded && kind !== 'complete' ? 'text-lg' : 'text-base',
                )}
              >
                {title}
              </span>
              {subtitle ? (
                <span className="mt-1 block text-sm text-ink-muted">{subtitle}</span>
              ) : null}
            </button>
            {kind === 'complete' ? (
              <button
                type="button"
                className="mt-0.5 shrink-0 text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                onClick={dismissComplete}
                data-testid="wallet-nudge-dismiss-complete"
              >
                {t('app.close')}
              </button>
            ) : null}
          </div>
          {expanded && kind !== 'complete' ? (
            <Progress
              value={stepPct}
              className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-sand-deep"
              data-testid="wallet-nudge-header-progress"
            />
          ) : null}
          {kind === 'complete' ? (
            <Progress
              value={100}
              className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-sand-deep"
              data-testid="wallet-nudge-complete-progress"
            />
          ) : null}
        </div>

        {expanded && kind !== 'complete' ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0 max-h-[min(72dvh,36rem)]"
            bodyClassName="space-y-1 px-5 pt-5"
            footerClassName="px-5 pt-3"
          >
            <OnboardingWizardBody
              key={`gaps-${profile.motoristId}-${remainingPct}`}
              onClose={() => setExpanded(false)}
              onFinished={() => setExpanded(false)}
              showStepTitle={false}
              showProgress={false}
              gapsOnly
            />
          </StickyActionsProvider>
        ) : null}
      </div>
    </div>
  )
}
