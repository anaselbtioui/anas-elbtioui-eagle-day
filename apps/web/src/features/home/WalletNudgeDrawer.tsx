import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { LoadingLine } from '@/components/ui/loading-line'
import { Progress } from '@/components/ui/progress'
import { StickyActions, StickyActionsProvider } from '@/components/ui/sticky-actions'
import { OnboardingWizardBody } from '@/features/onboarding/OnboardingPage'
import {
  deriveOnboardingPhase,
  onboardingGapCount,
  onboardingRemainingPercent,
} from '@/services/onboarding-phase.ts'
import { type Wallet } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile'
import { cn } from '@/lib/utils'

export type WalletNudgeKind = 'empty' | 'expired' | 'expiring' | 'complete' | null

export {
  walletEssentialsFilled,
  walletRemainingPercent,
  walletClaimReady,
  walletFullyComplete,
} from '@/services/wallet.ts'

/** Soften title / % ticks while typing. */
const DISPLAY_DEBOUNCE_MS = 180
/** Last gap → finish: hold while bar animates, then swap body. */
const COMPLETE_SETTLE_MS = 700

function dismissKey(motoristId: string) {
  return `labas-wallet-complete-dismissed:${motoristId || 'anon'}`
}

/** Map derived phase → nudge chrome (null = hide). */
export function walletNudgeKind(profile: Wallet, completeDismissed = false): WalletNudgeKind {
  const phase = deriveOnboardingPhase(profile)
  if (phase === 'gaps' || phase === 'claimReady') return 'empty'
  if (phase === 'expired') return 'expired'
  if (phase === 'expiring') return 'expiring'
  if (phase === 'complete' && !completeDismissed) return 'complete'
  return null
}

/**
 * Docked bottom drawer: collapsed peek → expands into onboarding wizard.
 * Incomplete: resume only gap steps with highlighted inputs.
 * Complete: ending state peek (dismissible).
 * Last gap while open: debounce + settle animation, then finish panel — no abrupt vanish.
 */
export function WalletNudgeDrawer({ profile }: { profile: Wallet }) {
  const { t } = useTranslation()
  const setWalletEditing = useProfileStore((s) => s.setWalletEditing)
  const pullRemoteProfile = useProfileStore((s) => s.pullRemoteProfile)
  const [expanded, setExpanded] = useState(false)
  const [completeDismissed, setCompleteDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(dismissKey(profile.motoristId)) === '1'
    } catch {
      return false
    }
  })

  const rawKind = walletNudgeKind(profile, completeDismissed)
  const rawRemainingPct = useMemo(() => onboardingRemainingPercent(profile), [profile])
  const rawGapCount = useMemo(() => onboardingGapCount(profile), [profile])
  const rawStepPct = rawKind === 'complete' ? 100 : Math.max(0, 100 - rawRemainingPct)

  const [displayKind, setDisplayKind] = useState(rawKind)
  const [displayRemainingPct, setDisplayRemainingPct] = useState(rawRemainingPct)
  const [displayGapCount, setDisplayGapCount] = useState(rawGapCount)
  const [displayStepPct, setDisplayStepPct] = useState(rawStepPct)
  /** true while last gap just filled — bar runs to 100% before finish panel. */
  const [settling, setSettling] = useState(false)

  useEffect(() => {
    try {
      setCompleteDismissed(sessionStorage.getItem(dismissKey(profile.motoristId)) === '1')
    } catch {
      setCompleteDismissed(false)
    }
  }, [profile.motoristId])

  useEffect(() => {
    setWalletEditing(expanded)
    if (!expanded) {
      void pullRemoteProfile()
    }
    return () => setWalletEditing(false)
  }, [expanded, setWalletEditing, pullRemoteProfile])

  // Reset settle if drawer closes or profile regresses.
  useEffect(() => {
    if (!expanded || rawKind !== 'complete') {
      setSettling(false)
    }
  }, [expanded, rawKind])

  // Debounced display + complete settle sequence.
  useEffect(() => {
    const becomingComplete =
      expanded &&
      rawKind === 'complete' &&
      displayKind !== 'complete' &&
      displayKind !== null

    if (becomingComplete) {
      setSettling(true)
      setDisplayStepPct(100)
      const timer = window.setTimeout(() => {
        setDisplayKind('complete')
        setDisplayRemainingPct(0)
        setDisplayGapCount(0)
        setSettling(false)
      }, COMPLETE_SETTLE_MS)
      return () => window.clearTimeout(timer)
    }

    // Incomplete / other kinds: short debounce so % title does not thrash.
    const timer = window.setTimeout(() => {
      setDisplayKind(rawKind)
      setDisplayRemainingPct(rawRemainingPct)
      setDisplayGapCount(rawGapCount)
      setDisplayStepPct(rawStepPct)
    }, DISPLAY_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [
    expanded,
    rawKind,
    rawRemainingPct,
    rawGapCount,
    rawStepPct,
    displayKind,
  ])

  const kind = displayKind
  const finishingInDrawer = expanded && kind === 'complete' && !settling
  const showGapsWizard =
    expanded && !settling && kind !== 'complete' && kind !== null
  const showSettling = expanded && settling

  if (!kind && !settling) return null

  function dismissComplete() {
    try {
      sessionStorage.setItem(dismissKey(profile.motoristId), '1')
    } catch {
      /* ignore */
    }
    setCompleteDismissed(true)
    setExpanded(false)
  }

  function collapseFinish() {
    setExpanded(false)
  }

  const title =
    settling || kind === 'complete'
      ? t('motorist.walletNudgeComplete')
      : kind === 'empty'
        ? t('motorist.walletNudgeRemaining', { pct: displayRemainingPct })
        : kind === 'expired'
          ? t('motorist.walletNudgeExpired')
          : kind === 'expiring'
            ? t('motorist.walletNudgeExpiring')
            : t('motorist.walletNudgeComplete')

  const subtitle =
    settling
      ? null
      : kind === 'empty' && displayGapCount > 0
        ? t('motorist.walletNudgeGaps', { count: displayGapCount })
        : kind === 'complete'
          ? t('motorist.walletNudgeCompleteHint')
          : null

  const shellExpanded = showGapsWizard || showSettling || finishingInDrawer

  return (
    <div className="relative z-50 flex w-full justify-center px-4 md:px-8">
      <div
        className={cn(
          'relative w-full max-w-lg border border-b-0 border-border bg-surface shadow-[0_-8px_40px_rgba(16,40,96,0.12)]',
          'rounded-t-[1.25rem]',
          'transition-[max-height,background-color,border-color] duration-500 ease-out',
          shellExpanded && 'flex max-h-[min(90dvh,44rem)] flex-col',
          (kind === 'complete' || settling) && 'border-moss/30 bg-moss/5',
        )}
        data-testid="wallet-nudge-drawer"
        data-wallet-nudge={kind ?? 'empty'}
        data-wallet-settling={settling ? '1' : undefined}
        data-wallet-finishing={finishingInDrawer ? '1' : undefined}
        role="dialog"
        aria-expanded={expanded}
        aria-busy={settling || undefined}
        aria-labelledby="wallet-nudge-title"
      >
        <div className="relative shrink-0">
          {shellExpanded ? (
            <div className="flex justify-start px-2 pt-2">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
                onClick={
                  finishingInDrawer || settling
                    ? collapseFinish
                    : () => setExpanded(false)
                }
                aria-label={t('app.close')}
                disabled={settling}
              >
                <LabasIcon name="close" className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ) : null}
          <div
            className={cn(
              'flex w-full items-start gap-3 text-left',
              shellExpanded ? 'px-5 pb-4 pt-1' : 'px-5 pb-4 pt-4',
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                if (kind === 'complete' || settling) return
                if (!expanded) setExpanded(true)
              }}
              disabled={expanded || kind === 'complete' || settling}
              data-testid="wallet-nudge-reopen"
            >
              <span
                id="wallet-nudge-title"
                className={cn(
                  'block text-balance font-display font-bold leading-snug transition-colors duration-500 ease-out',
                  kind === 'complete' || settling ? 'text-moss' : 'text-ink',
                  shellExpanded ? 'text-lg' : 'text-base',
                )}
              >
                {title}
              </span>
              {subtitle ? (
                <span className="mt-1 block text-sm text-ink-muted transition-opacity duration-300 ease-out">
                  {subtitle}
                </span>
              ) : null}
            </button>
            {kind === 'complete' && !finishingInDrawer && !settling ? (
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
          {shellExpanded || kind === 'complete' ? (
            <Progress
              value={displayStepPct}
              durationMs={COMPLETE_SETTLE_MS}
              className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-sand-deep"
              data-testid={
                kind === 'complete' || settling
                  ? 'wallet-nudge-complete-progress'
                  : 'wallet-nudge-header-progress'
              }
            />
          ) : null}
        </div>

        {showGapsWizard ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0 max-h-[min(72dvh,36rem)] transition-opacity duration-300 ease-out"
            bodyClassName="space-y-1 px-5 pt-5"
            footerClassName="px-5 pt-3"
          >
            <OnboardingWizardBody
              key={`gaps-${profile.motoristId}`}
              onClose={() => setExpanded(false)}
              onFinished={() => setExpanded(false)}
              showStepTitle={false}
              showProgress={false}
              gapsOnly
            />
          </StickyActionsProvider>
        ) : null}

        {showSettling ? (
          <div
            className="flex min-h-[8rem] flex-col items-center justify-center gap-3 px-5 py-10 opacity-100 transition-opacity duration-300 ease-out"
            data-testid="wallet-nudge-settling"
          >
            <LoadingLine label={t('motorist.walletNudgeSettling')} />
          </div>
        ) : null}

        {finishingInDrawer ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0 opacity-100 transition-opacity duration-500 ease-out"
            bodyClassName="space-y-4 px-5 pt-5"
            footerClassName="px-5 pt-3"
          >
            <p className="text-sm leading-relaxed text-ink-muted">
              {t('motorist.walletNudgeCompleteHint')}
            </p>
            <StickyActions>
              <Button
                className="w-full"
                type="button"
                onClick={collapseFinish}
                data-testid="wallet-nudge-finish-done"
              >
                {t('app.close')}
              </Button>
            </StickyActions>
          </StickyActionsProvider>
        ) : null}
      </div>
    </div>
  )
}
