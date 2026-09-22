import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout } from '@/app/AuthSplitLayout'
import { MobileShell } from '@/app/MobileShell'
import { BrandLogo } from '@/components/BrandLogo'
import { InsurerSelect } from '@/components/InsurerSelect'
import { VehicleSelect } from '@/components/VehicleSelect'
import { LogoutButton } from '@/components/LogoutButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { Progress } from '@/components/ui/progress'
import { isValidMoroccanPhone } from '@/lib/phone'
import { StickyActions } from '@/components/ui/sticky-actions'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { LocalPhotoField } from '@/features/onboarding/LocalPhotoField'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { api } from '@/services/api.ts'
import { attestationDaysRemaining } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'

export const ONBOARDING_STEPS = [
  'welcome',
  'otp',
  'identity',
  'permis',
  'carteGrise',
  'attestation',
  'broker',
  'assistance',
  'review',
  'done',
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

const STEP_COUNT = ONBOARDING_STEPS.length

function stepTitleKey(id: OnboardingStepId): string {
  return `onboarding.steps.${id}`
}

function StepNav({
  onBack,
  onSkip,
  onContinue,
  continueLabel,
  continueDisabled,
  showSkip = true,
}: {
  onBack: () => void
  onSkip?: () => void
  onContinue: () => void
  continueLabel?: string
  continueDisabled?: boolean
  showSkip?: boolean
}) {
  const { t } = useTranslation()
  return (
    <StickyActions>
      <Button variant="ghost" className="w-full" type="button" onClick={onBack}>
        {t('app.back')}
      </Button>
      <Button
        className="min-w-0 w-full whitespace-normal text-center leading-snug"
        type="button"
        onClick={onContinue}
        disabled={continueDisabled}
      >
        {continueLabel ?? t('app.continue')}
      </Button>
      {showSkip && onSkip ? (
        <button
          type="button"
          className="w-full basis-full text-center text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
          onClick={onSkip}
        >
          {t('app.skip')}
        </button>
      ) : null}
    </StickyActions>
  )
}

function BrokerPickStep({
  onBack,
  onSkip,
  onContinue,
}: {
  onBack: () => void
  onSkip: () => void
  onContinue: () => void
}) {
  const { t } = useTranslation()
  const { profile, setProfile } = useProfileStore()
  const [brokers, setBrokers] = useState<
    Array<{ id: string; displayName: string; email: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .listRegisteredBrokers()
      .then((list) => {
        if (cancelled) return
        setBrokers(list)
        setLoading(false)
        const current = useProfileStore.getState().profile
        if (list.length === 1 && !current.brokerId) {
          const only = list[0]!
          setProfile({ brokerId: only.id, broker: only.displayName })
        } else if (
          current.brokerId &&
          !list.some((b) => b.id === current.brokerId)
        ) {
          setProfile({ brokerId: '', broker: '' })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'load_failed')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [setProfile])

  function pick(id: string, displayName: string) {
    setProfile({ brokerId: id, broker: displayName })
  }

  function continueWithBroker() {
    if (!profile.brokerId) return
    onContinue()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('onboarding.brokerPickHint')}</p>
      {loading ? <p className="text-sm text-ink-muted">{t('later.loading')}</p> : null}
      {loadError ? <p className="text-sm text-alert">{t('onboarding.brokerPickError')}</p> : null}
      {!loading && brokers.length === 0 ? (
        <p className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-3 text-sm text-ink-muted">
          {t('onboarding.brokerPickEmpty')}
        </p>
      ) : null}
      <ul className="space-y-2" data-testid="broker-pick-list">
        {brokers.map((b) => {
          const selected = profile.brokerId === b.id
          return (
            <li key={b.id}>
              <button
                type="button"
                data-testid={`broker-pick-${b.id}`}
                onClick={() => pick(b.id, b.displayName)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-[var(--radius-labas)] border px-3 py-3 text-left transition-colors',
                  selected
                    ? 'border-ink bg-ink-soft outline outline-1 outline-ink/20'
                    : 'border-border bg-surface/90 hover:bg-sand-deep/70',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-ink bg-ink' : 'border-border',
                  )}
                  aria-hidden
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-sand" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{b.displayName}</span>
                  <span className="mt-0.5 block truncate text-sm text-ink-muted">{b.email}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <StepNav
        onBack={onBack}
        onSkip={brokers.length === 0 ? onSkip : undefined}
        onContinue={continueWithBroker}
        continueDisabled={brokers.length > 0 && !profile.brokerId}
        showSkip={brokers.length === 0}
      />
    </div>
  )
}

function ExpiryReminder({ validUntil }: { validUntil: string }) {
  const { t } = useTranslation()
  const days = attestationDaysRemaining(validUntil)
  if (days === null) return null
  if (days < 0) {
    return (
      <p className="rounded-[var(--radius-labas)] bg-alert/10 px-3 py-2 text-sm text-alert">
        {t('onboarding.attestationExpired', { date: validUntil })}
      </p>
    )
  }
  if (days <= 45) {
    return (
      <p className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm text-ink">
        {t('onboarding.attestationExpiryReminder', { date: validUntil, days })}
      </p>
    )
  }
  return null
}

function OnboardingSteps({
  step,
  goTo,
  onLeave,
  onFinish,
}: {
  step: number
  goTo: (n: number) => void
  onLeave: () => void
  onFinish: () => void
}) {
  const { t } = useTranslation()
  const { profile, setProfile } = useProfileStore()
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const id = ONBOARDING_STEPS[Math.min(Math.max(step, 0), STEP_COUNT - 1)]

  const next = () => goTo(Math.min(step + 1, STEP_COUNT - 1))
  const prev = () => {
    if (step <= 0) onLeave()
    else goTo(step - 1)
  }
  const skip = () => next()

  if (id === 'welcome') {
    return (
      <div className="space-y-5">
        <p className="text-lg font-medium leading-snug text-ink md:text-xl">
          {t('onboarding.welcomeBody')}
        </p>
        <StepNav onBack={prev} onContinue={next} onSkip={skip} />
      </div>
    )
  }

  if (id === 'otp') {
    const phoneOk = isValidMoroccanPhone(profile.phone)
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{t('onboarding.otpHint')}</p>
        <PhoneInput
          id="otp-phone"
          label={t('onboarding.phone')}
          value={profile.phone}
          onChange={(e164) => setProfile({ phone: e164 })}
          required
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={!phoneOk}
          onClick={() => setOtpSent(true)}
        >
          {t('onboarding.otpSend')}
        </Button>
        {otpSent ? (
          <div className="space-y-2">
            <Label htmlFor="otp-code">{t('onboarding.otpCode')}</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
            />
            <p className="text-xs text-ink-muted">{t('onboarding.otpMockNote')}</p>
          </div>
        ) : null}
        <StepNav
          onBack={prev}
          onSkip={skip}
          continueDisabled={!phoneOk}
          onContinue={() => {
            if (otpCode.trim().length >= 4) setProfile({ phoneVerified: true })
            next()
          }}
        />
      </div>
    )
  }

  if (id === 'identity') {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">{t('onboarding.name')}</Label>
          <Input
            id="name"
            value={profile.name}
            onChange={(e) => setProfile({ name: e.target.value })}
            autoComplete="name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cin">{t('onboarding.cin')}</Label>
          <Input
            id="cin"
            value={profile.cin}
            onChange={(e) => setProfile({ cin: e.target.value })}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{t('onboarding.city')}</Label>
          <Input
            id="city"
            value={profile.city}
            onChange={(e) => setProfile({ city: e.target.value })}
          />
        </div>
        <StepNav onBack={prev} onSkip={skip} onContinue={next} />
      </div>
    )
  }

  if (id === 'permis') {
    return (
      <div className="space-y-4">
        <LocalPhotoField
          label={t('onboarding.licensePhoto')}
          hint={t('onboarding.photoLocalOnly')}
          value={profile.licensePhotoLocal}
          onChange={(licensePhotoLocal) => setProfile({ licensePhotoLocal })}
        />
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">{t('onboarding.licenseNumber')}</Label>
          <Input
            id="licenseNumber"
            value={profile.licenseNumber}
            onChange={(e) => setProfile({ licenseNumber: e.target.value })}
          />
        </div>
        <StepNav onBack={prev} onSkip={skip} onContinue={next} />
      </div>
    )
  }

  if (id === 'carteGrise') {
    return (
      <div className="space-y-4">
        <LocalPhotoField
          label={t('onboarding.carteGrisePhoto')}
          hint={t('onboarding.photoLocalOnly')}
          value={profile.carteGrisePhotoLocal}
          onChange={(carteGrisePhotoLocal) => setProfile({ carteGrisePhotoLocal })}
        />
        <div className="space-y-2">
          <Label htmlFor="plate">{t('onboarding.plate')}</Label>
          <Input
            id="plate"
            value={profile.plate}
            onChange={(e) => setProfile({ plate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle">{t('onboarding.vehicle')}</Label>
          <VehicleSelect
            id="vehicle"
            value={profile.vehicle}
            onChange={(vehicle) => setProfile({ vehicle })}
          />
        </div>
        <StepNav onBack={prev} onSkip={skip} onContinue={next} />
      </div>
    )
  }

  if (id === 'attestation') {
    return (
      <div className="space-y-4">
        <LocalPhotoField
          label={t('onboarding.attestationPhoto')}
          hint={t('onboarding.photoLocalOnly')}
          value={profile.attestationPhotoLocal}
          onChange={(attestationPhotoLocal) => setProfile({ attestationPhotoLocal })}
        />
        <div className="space-y-2">
          <Label htmlFor="insurer">{t('onboarding.insurer')}</Label>
          <InsurerSelect
            id="insurer"
            value={profile.insurer}
            onChange={(insurer) => setProfile({ insurer })}
            placeholder={t('onboarding.insurerPick')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="policy">{t('onboarding.policy')}</Label>
          <Input
            id="policy"
            value={profile.policy}
            onChange={(e) => setProfile({ policy: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attestationValidUntil">{t('onboarding.attestationValidUntil')}</Label>
          <Input
            id="attestationValidUntil"
            type="date"
            value={profile.attestationValidUntil}
            onChange={(e) => setProfile({ attestationValidUntil: e.target.value })}
          />
        </div>
        <ExpiryReminder validUntil={profile.attestationValidUntil} />
        <StepNav onBack={prev} onSkip={skip} onContinue={next} />
      </div>
    )
  }

  if (id === 'broker') {
    return <BrokerPickStep onBack={prev} onSkip={skip} onContinue={next} />
  }

  if (id === 'assistance') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{t('onboarding.assistanceHint')}</p>
        <div className="space-y-2">
          <Label htmlFor="assistance">{t('onboarding.assistance')}</Label>
          <Input
            id="assistance"
            inputMode="tel"
            value={profile.assistanceNumber}
            onChange={(e) => setProfile({ assistanceNumber: e.target.value })}
          />
        </div>
        <StepNav onBack={prev} onSkip={skip} onContinue={next} />
      </div>
    )
  }

  if (id === 'review') {
    const rows: Array<[string, string]> = [
      [t('onboarding.name'), profile.name || '—'],
      [t('onboarding.cin'), profile.cin || '—'],
      [t('onboarding.phone'), profile.phone || '—'],
      [t('onboarding.licenseNumber'), profile.licenseNumber || '—'],
      [t('onboarding.plate'), profile.plate || '—'],
      [t('onboarding.vehicle'), profile.vehicle || '—'],
      [t('onboarding.insurer'), profile.insurer || '—'],
      [t('onboarding.policy'), profile.policy || '—'],
      [t('onboarding.attestationValidUntil'), profile.attestationValidUntil || '—'],
      [t('onboarding.broker'), profile.broker || '—'],
      [t('onboarding.assistance'), profile.assistanceNumber || '—'],
    ]
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{t('onboarding.reviewHint')}</p>
        <ExpiryReminder validUntil={profile.attestationValidUntil} />
        <dl className="space-y-2 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-border/60 py-1.5">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="max-w-[55%] text-right font-medium text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-ink-muted">{t('onboarding.photoLocalOnly')}</p>
        <StepNav onBack={prev} onContinue={next} showSkip={false} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-muted">{t('onboarding.doneBody')}</p>
      <StepNav
        onBack={prev}
        onContinue={onFinish}
        continueLabel={t('onboarding.done')}
        showSkip={false}
      />
    </div>
  )
}

export function useOnboardingWizard(opts: {
  onClose: () => void
  onFinished: () => void
}) {
  const { t } = useTranslation()
  const { profile, completeOnboarding, error, saving, setProfile } = useProfileStore()
  const user = useSessionStore((s) => s.user)
  const [step, setStep] = useState(() =>
    Math.min(Math.max(profile.onboardingStep || 0, 0), STEP_COUNT - 1),
  )

  const stepId = ONBOARDING_STEPS[step] ?? 'welcome'
  const stepTitle = t(stepTitleKey(stepId))

  function goTo(n: number) {
    const clamped = Math.min(Math.max(n, 0), STEP_COUNT - 1)
    setStep(clamped)
    setProfile({ onboardingStep: clamped })
  }

  useEffect(() => {
    if (!user?.motoristId) return
    if (profile.motoristId === user.motoristId) return
    setProfile({
      motoristId: user.motoristId,
      vehicleId: user.vehicleId ?? '',
      insurerId: user.insurerId ?? '',
      // Keep a broker already picked in the wallet if auth claims lag.
      brokerId: user.brokerId || profile.brokerId || '',
      policyId: user.policyId ?? '',
      name: profile.name || user.displayName,
    })
  }, [user, profile.motoristId, profile.name, profile.brokerId, setProfile])

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
      try {
        const session = await api.refresh()
        useSessionStore.getState().applyAuth(session.token, session.user)
      } catch {
        /* wallet already saved; refresh is best-effort */
      }
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

/** Wizard body without Sheet chrome — embed in docked drawer / edit sheet. */
export function OnboardingWizardBody({
  onClose,
  onFinished,
  showStepTitle = true,
}: {
  onClose: () => void
  onFinished: () => void
  showStepTitle?: boolean
}) {
  const { t } = useTranslation()
  const { stepId, stepTitle, progress, form } = useOnboardingWizard({ onClose, onFinished })
  return (
    <div className="space-y-3" data-testid="onboarding-wizard-body">
      {progress}
      {showStepTitle ? (
        <h2 className="font-display text-xl font-bold text-ink">{stepTitle}</h2>
      ) : null}
      {showStepTitle && stepId !== 'welcome' ? (
        <p className="text-sm text-ink-muted">{t('onboarding.subtitle')}</p>
      ) : null}
      {form}
    </div>
  )
}

/** In-session edit: bottom drawer wizard only — never AuthSplit screenshot. */
export function OnboardingEditSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideClose={false}
        className="max-w-lg"
        data-testid="onboarding-edit-drawer"
      >
        {open ? (
          <OnboardingWizardBody onClose={close} onFinished={close} showStepTitle />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/** First-time / login context only — AuthSplit screenshot on desktop. */
export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)
  const signOut = useSessionStore((s) => s.signOut)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 48em)')

  function leaveLogin() {
    if (!confirm(`${t('auth.logoutConfirmTitle')}\n\n${t('auth.logoutConfirmBody')}`)) return
    signOut()
    navigate('/', { replace: true })
  }

  const wizard = useOnboardingWizard({
    onClose: leaveLogin,
    onFinished: () => {
      setDrawerOpen(false)
      navigate('/')
    },
  })

  // Already onboarded → stay in admin shell, open edit drawer via settings.
  if (profile.onboarded) {
    return <Navigate to="/" replace />
  }

  const { stepId, stepTitle, goTo, progress, form } = wizard

  if (isDesktop) {
    return (
      <AuthSplitLayout
        brandTitle={t('onboarding.title')}
        brandBody={t('onboarding.subtitle')}
      >
        <AuthFormCard
          title={stepTitle}
          lead={stepId === 'welcome' ? undefined : t('onboarding.subtitle')}
          progress={progress}
        >
          {form}
        </AuthFormCard>
      </AuthSplitLayout>
    )
  }

  return (
    <MobileShell hideHeader>
      <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col items-center justify-center gap-7 px-4 pb-10 pt-6">
        <BrandLogo size="xl" className="mb-1 drop-shadow-none" />
        <p className="font-display max-w-[18rem] text-center text-[1.35rem] font-semibold leading-snug text-ink">
          {t('onboarding.subtitle')}
        </p>
        <Button
          className="w-full max-w-xs"
          size="lg"
          onClick={() => {
            goTo(profile.onboardingStep || 0)
            setDrawerOpen(true)
          }}
        >
          {t('onboarding.openDrawer')}
        </Button>
        {profile.onboardingStep > 0 ? (
          <p className="text-sm text-ink-muted">{t('onboarding.resumeHint')}</p>
        ) : null}
        <LogoutButton />
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent hideClose={false}>
          <div className="mb-4 space-y-3">
            {progress}
            <SheetTitle>{stepTitle}</SheetTitle>
            {stepId === 'welcome' ? null : (
              <SheetDescription>{t('onboarding.subtitle')}</SheetDescription>
            )}
          </div>
          {form}
        </SheetContent>
      </Sheet>
    </MobileShell>
  )
}
