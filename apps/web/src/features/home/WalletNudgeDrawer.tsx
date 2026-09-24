import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { LoadingLine } from '@/components/ui/loading-line'
import { Progress } from '@/components/ui/progress'
import { StickyActions, StickyActionsProvider } from '@/components/ui/sticky-actions'
import { BrokerPickStep } from '@/features/onboarding/BrokerPickStep'
import { OnboardingWizardBody } from '@/features/onboarding/OnboardingPage'
import {
  deriveOnboardingPhase,
  onboardingGapCount,
  onboardingRemainingPercent,
} from '@/services/onboarding-phase.ts'
import { type Wallet } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile'
import { cn } from '@/lib/utils'

export type WalletNudgeKind =
  | 'empty'
  | 'expired'
  | 'expiring'
  | 'complete'
  | 'brokerAssigned'
  | null

export {
  walletEssentialsFilled,
  walletRemainingPercent,
  walletClaimReady,
  walletFullyComplete,
} from '@/services/wallet.ts'

/** Soften title / % ticks while typing. */
const DISPLAY_DEBOUNCE_MS = 180
/** Last gap → finish: hold while bar animates, then swap body. */
const COMPLETE_SETTLE_MS = 900

function dismissKey(motoristId: string) {
  return `labas-wallet-complete-dismissed:${motoristId || 'anon'}`
}

function brokerAssignShownKey(motoristId: string) {
  return `labas-broker-assign-shown:${motoristId || 'anon'}`
}

/** Map derived phase → nudge chrome (null = hide). */
export function walletNudgeKind(profile: Wallet, completeDismissed = false): WalletNudgeKind {
  const phase = deriveOnboardingPhase(profile)
  if (phase === 'brokerAssigned') return 'brokerAssigned'
  if (phase === 'gaps' || phase === 'claimReady') return 'empty'
  if (phase === 'expired') return 'expired'
  if (phase === 'expiring') return 'expiring'
  if (phase === 'complete' && !completeDismissed) return 'complete'
  return null
}

/** Portefeuille fields full — includes complete and expiring (attestation ≤45d). */
function walletFieldsDone(kind: WalletNudgeKind, remainingPct: number): boolean {
  if (remainingPct > 0) return false
  if (kind === 'brokerAssigned') return false
  return kind === 'complete' || kind === 'expiring'
}

/**
 * Docked bottom drawer: collapsed peek → expands into onboarding wizard.
 * Last gap while open: latch finish flow until user closes — never auto-unmount.
 */
export function WalletNudgeDrawer({ profile }: { profile: Wallet }) {
  const { t } = useTranslation()
  const setWalletEditing = useProfileStore((s) => s.setWalletEditing)
  const pullRemoteProfile = useProfileStore((s) => s.pullRemoteProfile)
  const persistDraftNow = useProfileStore((s) => s.persistDraftNow)
  const ackBrokerAutoAssign = useProfileStore((s) => s.ackBrokerAutoAssign)
  const [expanded, setExpanded] = useState(false)
  const [changingBroker, setChangingBroker] = useState(false)
  const [acking, setAcking] = useState(false)
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
  const rawStepPct =
    walletFieldsDone(rawKind, rawRemainingPct) ? 100 : Math.max(0, 100 - rawRemainingPct)

  const [displayKind, setDisplayKind] = useState(rawKind)
  const [displayRemainingPct, setDisplayRemainingPct] = useState(rawRemainingPct)
  const [displayGapCount, setDisplayGapCount] = useState(rawGapCount)
  const [displayStepPct, setDisplayStepPct] = useState(rawStepPct)
  /** Bar + spinner while last gap settles. */
  const [settling, setSettling] = useState(false)
  /** Locked until user closes — survives kind/poll churn. */
  const [finishFlow, setFinishFlow] = useState(false)
  const finishStarted = useRef(false)

  useEffect(() => {
    try {
      setCompleteDismissed(sessionStorage.getItem(dismissKey(profile.motoristId)) === '1')
    } catch {
      setCompleteDismissed(false)
    }
    finishStarted.current = false
    setFinishFlow(false)
    setSettling(false)
    setChangingBroker(false)
  }, [profile.motoristId])

  // Auto-expand once per session so they cannot only see green Wallet ready.
  useEffect(() => {
    if (rawKind !== 'brokerAssigned') return
    try {
      if (sessionStorage.getItem(brokerAssignShownKey(profile.motoristId)) === '1') return
      sessionStorage.setItem(brokerAssignShownKey(profile.motoristId), '1')
    } catch {
      /* ignore */
    }
    setExpanded(true)
  }, [rawKind, profile.motoristId])

  // Parent owns editing flag for whole expanded life (wizard must not clear it).
  // On collapse: flush then pull so last gap is on server before GET can regress UI.
  useEffect(() => {
    setWalletEditing(expanded)
    if (expanded) return
    setChangingBroker(false)
    let cancelled = false
    void (async () => {
      try {
        await persistDraftNow()
      } catch {
        /* best-effort */
      }
      if (!cancelled) await pullRemoteProfile()
    })()
    return () => {
      cancelled = true
    }
  }, [expanded, setWalletEditing, persistDraftNow, pullRemoteProfile])

  useEffect(() => {
    return () => setWalletEditing(false)
  }, [setWalletEditing])

  // Start finish latch once when fields hit 0% while open (not while assign notice pending).
  useEffect(() => {
    if (!expanded) {
      finishStarted.current = false
      setFinishFlow(false)
      setSettling(false)
      return
    }
    if (rawKind === 'brokerAssigned') return
    if (!walletFieldsDone(rawKind, rawRemainingPct)) return
    if (finishStarted.current) return
    finishStarted.current = true
    setFinishFlow(true)
    setSettling(true)
    setDisplayStepPct(100)
    setDisplayRemainingPct(0)
    setDisplayGapCount(0)
    void persistDraftNow().catch(() => undefined)
    const timer = window.setTimeout(() => {
      setSettling(false)
      setDisplayKind(rawKind === 'expiring' ? 'expiring' : 'complete')
    }, COMPLETE_SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [expanded, rawKind, rawRemainingPct, persistDraftNow])

  // Debounce chrome while still filling gaps (not during finish latch).
  useEffect(() => {
    if (finishFlow || settling) return
    const timer = window.setTimeout(() => {
      setDisplayKind(rawKind)
      setDisplayRemainingPct(rawRemainingPct)
      setDisplayGapCount(rawGapCount)
      setDisplayStepPct(rawStepPct)
    }, DISPLAY_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [finishFlow, settling, rawKind, rawRemainingPct, rawGapCount, rawStepPct])

  const kind = finishFlow ? displayKind ?? 'complete' : displayKind
  const finishingInDrawer = expanded && finishFlow && !settling
  const showBrokerAssignSheet = expanded && kind === 'brokerAssigned' && !changingBroker
  const showChangeBroker = expanded && kind === 'brokerAssigned' && changingBroker
  const showGapsWizard =
    expanded && !finishFlow && kind !== null && kind !== 'brokerAssigned' && kind !== 'complete'
  const showSettling = expanded && settling
  const shellExpanded =
    showGapsWizard || showSettling || finishingInDrawer || showBrokerAssignSheet || showChangeBroker

  // Keep shell mounted during finish even if raw kind would hide (dismissed).
  if (!kind && !finishFlow && !settling) return null

  function dismissComplete() {
    try {
      sessionStorage.setItem(dismissKey(profile.motoristId), '1')
    } catch {
      /* ignore */
    }
    setCompleteDismissed(true)
    setFinishFlow(false)
    finishStarted.current = false
    setExpanded(false)
  }

  function collapseFinish() {
    // Persist dismiss so a late incomplete GET cannot reopen gaps peek as "done then undone".
    try {
      sessionStorage.setItem(dismissKey(profile.motoristId), '1')
    } catch {
      /* ignore */
    }
    setCompleteDismissed(true)
    setFinishFlow(false)
    finishStarted.current = false
    setSettling(false)
    setExpanded(false)
  }

  async function onGotIt() {
    setAcking(true)
    try {
      await ackBrokerAutoAssign()
      setChangingBroker(false)
    } finally {
      setAcking(false)
    }
  }

  const brokerName = profile.broker.trim() || '—'

  const title =
    settling || finishFlow
      ? kind === 'expiring'
        ? t('motorist.walletNudgeExpiring')
        : t('motorist.walletNudgeComplete')
      : kind === 'brokerAssigned'
        ? t('motorist.walletNudgeBrokerAssigned', { name: brokerName })
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
      : finishFlow
        ? t('motorist.walletNudgeCompleteHint')
        : kind === 'brokerAssigned'
          ? t('motorist.walletNudgeBrokerAssignedHint')
          : kind === 'empty' && displayGapCount > 0
            ? t('motorist.walletNudgeGaps', { count: displayGapCount })
            : kind === 'complete'
              ? t('motorist.walletNudgeCompleteHint')
              : null

  return (
    <div className="relative z-50 flex w-full justify-center px-4 md:px-8">
      <div
        className={cn(
          'relative w-full max-w-lg border border-b-0 border-border bg-surface shadow-[0_-8px_40px_rgba(16,40,96,0.12)]',
          'rounded-t-[1.25rem]',
          'transition-[max-height,background-color,border-color] duration-500 ease-out',
          shellExpanded && 'flex max-h-[min(90dvh,44rem)] flex-col',
          (finishFlow || kind === 'complete' || kind === 'expiring') &&
            'border-moss/30 bg-moss/5',
          kind === 'brokerAssigned' && 'border-ink/20',
        )}
        data-testid="wallet-nudge-drawer"
        data-wallet-nudge={kind ?? 'complete'}
        data-wallet-settling={settling ? '1' : undefined}
        data-wallet-finishing={finishingInDrawer ? '1' : undefined}
        role="dialog"
        aria-expanded={expanded}
        aria-busy={settling || acking || undefined}
        aria-labelledby="wallet-nudge-title"
      >
        <div className="relative shrink-0">
          {shellExpanded ? (
            <div className="flex justify-start px-2 pt-2">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96] disabled:opacity-40"
                onClick={finishFlow ? collapseFinish : () => setExpanded(false)}
                aria-label={t('app.close')}
                disabled={settling || acking}
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
                if (finishFlow || kind === 'complete') return
                if (!expanded) setExpanded(true)
              }}
              disabled={expanded || finishFlow || kind === 'complete'}
              data-testid="wallet-nudge-reopen"
            >
              <span
                id="wallet-nudge-title"
                className={cn(
                  'block text-balance font-display font-bold leading-snug transition-colors duration-500 ease-out',
                  finishFlow || kind === 'complete' || kind === 'expiring'
                    ? 'text-moss'
                    : 'text-ink',
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
            {(kind === 'complete' || kind === 'expiring') && !shellExpanded ? (
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
          {shellExpanded || kind === 'complete' || kind === 'expiring' ? (
            <Progress
              value={kind === 'brokerAssigned' ? 100 : displayStepPct}
              durationMs={COMPLETE_SETTLE_MS}
              className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-sand-deep"
              data-testid={
                finishFlow || kind === 'complete'
                  ? 'wallet-nudge-complete-progress'
                  : kind === 'brokerAssigned'
                    ? 'wallet-nudge-broker-assign-progress'
                    : 'wallet-nudge-header-progress'
              }
            />
          ) : null}
        </div>

        {showBrokerAssignSheet ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0"
            bodyClassName="space-y-4 px-5 pt-5"
            footerClassName="px-5 pt-3"
          >
            <div data-testid="wallet-nudge-broker-assign">
              <p className="text-sm leading-relaxed text-ink-muted">
                {t('motorist.walletNudgeBrokerAssignedHint')}
              </p>
            </div>
            <StickyActions>
              <div className="flex w-full flex-col gap-2">
                <Button
                  className="w-full"
                  type="button"
                  onClick={() => void onGotIt()}
                  disabled={acking}
                  data-testid="wallet-nudge-broker-assign-got-it"
                >
                  {t('motorist.walletNudgeBrokerAssignedGotIt')}
                </Button>
                <Button
                  className="w-full"
                  type="button"
                  variant="ghost"
                  onClick={() => setChangingBroker(true)}
                  disabled={acking}
                  data-testid="wallet-nudge-broker-assign-change"
                >
                  {t('motorist.walletNudgeBrokerAssignedChange')}
                </Button>
              </div>
            </StickyActions>
          </StickyActionsProvider>
        ) : null}

        {showChangeBroker ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0 max-h-[min(72dvh,36rem)]"
            bodyClassName="space-y-1 px-5 pt-5"
            footerClassName="px-5 pt-3"
          >
            <BrokerPickStep
              onBack={() => setChangingBroker(false)}
              onSkip={() => {
                setChangingBroker(false)
              }}
              onContinue={() => {
                setChangingBroker(false)
                void onGotIt()
              }}
              gapsOnly
            />
          </StickyActionsProvider>
        ) : null}

        {showGapsWizard ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0 max-h-[min(72dvh,36rem)]"
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
            className="flex min-h-[10rem] flex-col items-center justify-center gap-3 px-5 py-10"
            data-testid="wallet-nudge-settling"
          >
            <LoadingLine label={t('motorist.walletNudgeSettling')} />
          </div>
        ) : null}

        {finishingInDrawer ? (
          <StickyActionsProvider
            growBody={false}
            className="min-h-0"
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
