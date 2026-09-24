import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'
import { OnboardingSteps } from '@/features/onboarding/OnboardingSteps'
import {
  ONBOARDING_STEPS,
  STEP_COUNT,
  stepTitleKey,
} from '@/features/onboarding/steps'
import { api } from '@/services/api.ts'
import { resumeStepId } from '@/services/onboarding-phase.ts'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'

export function useOnboardingWizard(opts: {
  onClose: () => void
  onFinished: () => void
  /** Resume only incomplete portefeuille steps (wallet nudge). */
  gapsOnly?: boolean
}) {
  const { t } = useTranslation()
  const { profile, completeOnboarding, error, saving, setProfile, persistDraft, setWalletEditing } =
    useProfileStore()
  const user = useSessionStore((s) => s.user)
  const pullRemoteProfile = useProfileStore((s) => s.pullRemoteProfile)
  const [step, setStep] = useState(() => {
    if (opts.gapsOnly) {
      const gap = resumeStepId(profile)
      const idx = ONBOARDING_STEPS.indexOf(gap)
      return idx >= 0 ? idx : 0
    }
    return Math.min(Math.max(profile.onboardingStep || 0, 0), STEP_COUNT - 1)
  })

  const stepId = ONBOARDING_STEPS[step] ?? 'welcome'
  const stepTitle = t(stepTitleKey(stepId))

  // Pause remote poll while wizard is open; pull once on unmount.
  useEffect(() => {
    setWalletEditing(true)
    return () => {
      setWalletEditing(false)
      void pullRemoteProfile()
    }
  }, [setWalletEditing, pullRemoteProfile])

  function goTo(n: number) {
    const clamped = Math.min(Math.max(n, 0), STEP_COUNT - 1)
    setStep(clamped)
    setProfile({ onboardingStep: clamped })
    void persistDraft()
  }

  // One-shot auth seed — do not re-run on profile name ticks (avoids mid-edit writes).
  useEffect(() => {
    if (!user?.motoristId) return
    const fromAuth = (user.displayName ?? '').trim()
    const space = fromAuth.indexOf(' ')
    const authFirst = space < 0 ? fromAuth : fromAuth.slice(0, space).trim()
    const authLast = space < 0 ? '' : fromAuth.slice(space + 1).trim()
    const latest = useProfileStore.getState().profile
    const needsIds = latest.motoristId !== user.motoristId
    const needsNames =
      !latest.firstName.trim() &&
      !latest.lastName.trim() &&
      Boolean(authFirst || authLast)
    if (!needsIds && !needsNames) return
    setProfile({
      ...(needsIds
        ? {
            motoristId: user.motoristId,
            vehicleId: user.vehicleId ?? '',
            insurerId: user.insurerId ?? '',
            brokerId: user.brokerId || latest.brokerId || '',
            policyId: user.policyId ?? '',
          }
        : {}),
      firstName: latest.firstName || authFirst,
      lastName: latest.lastName || authLast,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot on user attach
  }, [user?.motoristId, user?.displayName, setProfile])

  async function finish() {
    let wallet = useProfileStore.getState().profile
    if (!wallet.brokerId.trim()) {
      try {
        const list = await api.listRegisteredBrokers()
        if (list.length === 1) {
          const only = list[0]!
          setProfile({ brokerId: only.id, broker: only.displayName })
          wallet = { ...wallet, brokerId: only.id, broker: only.displayName }
        } else {
          const brokerStep = ONBOARDING_STEPS.indexOf('broker')
          goTo(brokerStep >= 0 ? brokerStep : 0)
          useProfileStore.setState({ error: 'broker_required' })
          return
        }
      } catch {
        const brokerStep = ONBOARDING_STEPS.indexOf('broker')
        goTo(brokerStep >= 0 ? brokerStep : 0)
        useProfileStore.setState({ error: 'broker_required' })
        return
      }
    }
    try {
      await completeOnboarding()
      opts.onFinished()
    } catch {
      /* error shown from store */
    }
  }

  const progress = <Progress value={((step + 1) / STEP_COUNT) * 100} className="mb-3" />
  const form = (
    <>
      <OnboardingSteps
        step={step}
        goTo={goTo}
        onLeave={opts.onClose}
        onFinish={() => void finish()}
        gapsOnly={opts.gapsOnly}
      />
      {error ? (
        <p className="mt-3 text-sm text-alert">
          {error === 'broker_required' || error === 'broker_not_found'
            ? t('onboarding.saveErrorBroker')
            : t('onboarding.saveError')}
        </p>
      ) : null}
      {saving ? <p className="mt-2 text-sm text-ink-muted">{t('later.sending')}</p> : null}
    </>
  )

  return { stepId, stepTitle, goTo, progress, form, profile }
}
