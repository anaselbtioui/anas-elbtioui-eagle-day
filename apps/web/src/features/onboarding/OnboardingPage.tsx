import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout } from '@/app/AuthSplitLayout'
import { MobileShell } from '@/app/MobileShell'
import { BrandLogo } from '@/components/BrandLogo'
import { CitySelect } from '@/components/CitySelect'
import { InsurerSelect } from '@/components/InsurerSelect'
import { VehicleSelect } from '@/components/VehicleSelect'
import { LogoutButton } from '@/components/LogoutButton'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { FluidHover } from '@/components/ui/fluid-hover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingLine } from '@/components/ui/loading-line'
import { PhoneInput } from '@/components/ui/phone-input'
import { Progress } from '@/components/ui/progress'
import { isMoroccanCin, isMoroccanPlate, isPersonName, normalizeCin, normalizePlate } from '@/domain/ma-fields.ts'
import { isMoroccanCity } from '@/domain/moroccan-cities.ts'
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
import {
  attestationDaysRemaining,
  firstWalletGapStep,
  walletFieldNeedsInput,
  walletIncompleteSteps,
} from '@/services/wallet.ts'
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
const REVIEW_STEP = ONBOARDING_STEPS.indexOf('review')

/** Ring missing portefeuille inputs — only while resuming wallet gaps. */
function gapClass(
  gapsOnly: boolean,
  profile: Parameters<typeof walletFieldNeedsInput>[0],
  key: Parameters<typeof walletFieldNeedsInput>[1],
) {
  if (!gapsOnly || !walletFieldNeedsInput(profile, key)) return undefined
  return 'border-alert ring-2 ring-alert/35 focus-visible:ring-alert'
}

function gapAttr(
  gapsOnly: boolean,
  profile: Parameters<typeof walletFieldNeedsInput>[0],
  key: Parameters<typeof walletFieldNeedsInput>[1],
) {
  return gapsOnly && walletFieldNeedsInput(profile, key) ? true : undefined
}

function stepTitleKey(id: OnboardingStepId): string {
  return `onboarding.steps.${id}`
}

function StepNav({
  onBack,
  onSkip,
  onSkipAll,
  onContinue,
  continueLabel,
  continueDisabled,
  showSkip = true,
}: {
  onBack: () => void
  onSkip?: () => void
  onSkipAll?: () => void
  onContinue: () => void
  continueLabel?: string
  continueDisabled?: boolean
  showSkip?: boolean
}) {
  const { t } = useTranslation()
  const showSkipLinks = showSkip && (onSkip || onSkipAll)
  return (
    <StickyActions>
      <div className="flex w-full basis-full flex-col gap-3">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
          <Button
            variant="ghost"
            className="w-full sm:w-auto sm:min-w-[7.5rem] sm:flex-none"
            type="button"
            onClick={onBack}
          >
            {t('app.back')}
          </Button>
          <Button
            className="min-w-0 w-full flex-1 whitespace-normal text-center leading-snug"
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
          >
            {continueLabel ?? t('app.continue')}
          </Button>
        </div>
        {showSkipLinks ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {onSkip ? (
              <button
                type="button"
                className="min-h-10 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
                onClick={onSkip}
                data-testid="onboarding-skip-step"
              >
                {t('app.skipStep')}
              </button>
            ) : (
              <span aria-hidden className="min-h-10" />
            )}
            {onSkipAll ? (
              <button
                type="button"
                className="min-h-10 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
                onClick={onSkipAll}
                data-testid="onboarding-skip-all"
              >
                {t('app.skipAll')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </StickyActions>
  )
}

function BrokerPickStep({
  onBack,
  onSkip,
  onSkipAll,
  onContinue,
  gapsOnly = false,
}: {
  onBack: () => void
  onSkip: () => void
  onSkipAll?: () => void
  onContinue: () => void
  gapsOnly?: boolean
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
        if (list.length === 1) {
          const only = list[0]!
          if (current.brokerId !== only.id || current.broker !== only.displayName) {
            useProfileStore.getState().setProfile({
              brokerId: only.id,
              broker: only.displayName,
            })
          }
          // Persist now so Continue / skip do not leave wallet unlinked.
          void useProfileStore.getState().persistDraft()
        } else if (
          current.brokerId &&
          !list.some((b) => b.id === current.brokerId)
        ) {
          useProfileStore.getState().setProfile({ brokerId: '', broker: '' })
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
  }, [])

  function pick(id: string, displayName: string) {
    setProfile({ brokerId: id, broker: displayName })
    void useProfileStore.getState().persistDraft()
  }

  function continueWithBroker() {
    const wallet = useProfileStore.getState().profile
    if (!wallet.brokerId.trim()) return
    void useProfileStore.getState().persistDraft()
    onContinue()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('onboarding.brokerPickHint')}</p>
      {loading ? <LoadingLine className="text-sm" /> : null}
      {loadError ? <p className="text-sm text-alert">{t('onboarding.brokerPickError')}</p> : null}
      {!loading && brokers.length === 0 ? (
        <p className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-3 text-sm text-ink-muted">
          {t('onboarding.brokerPickEmpty')}
        </p>
      ) : null}
      <FluidHover>
        <ul
          className={cn(
            'space-y-2',
            gapAttr(gapsOnly, profile, 'brokerId') &&
              'rounded-[var(--radius-labas)] ring-2 ring-alert/35',
          )}
          data-testid="broker-pick-list"
          data-wallet-gap={gapAttr(gapsOnly, profile, 'brokerId')}
        >
          {brokers.map((b) => {
            const selected = profile.brokerId === b.id
            return (
              <li key={b.id}>
                <button
                  type="button"
                  data-testid={`broker-pick-${b.id}`}
                  data-fluid-item
                  onClick={() => pick(b.id, b.displayName)}
                  className={cn(
                    'relative z-[1] flex w-full items-start gap-3 rounded-[var(--radius-labas)] border px-3 py-3 text-left',
                    selected
                      ? 'border-ink bg-ink-soft outline outline-1 outline-ink/20'
                      : 'border-border bg-transparent',
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
      </FluidHover>
      <StepNav
        onBack={onBack}
        onSkip={brokers.length === 0 ? onSkip : undefined}
        onSkipAll={onSkipAll}
        onContinue={continueWithBroker}
        continueDisabled={loading || (brokers.length > 0 && !profile.brokerId.trim())}
        showSkip={brokers.length === 0 || Boolean(onSkipAll)}
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

export function OnboardingSteps({
  step,
  goTo,
  onLeave,
  onFinish,
  gapsOnly = false,
}: {
  step: number
  goTo: (n: number) => void
  onLeave: () => void
  onFinish: () => void
  /** Skip completed steps — resume wallet gaps only. */
  gapsOnly?: boolean
}) {
  const { t } = useTranslation()
  const { profile, setProfile } = useProfileStore()
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const id = ONBOARDING_STEPS[Math.min(Math.max(step, 0), STEP_COUNT - 1)]

  function nextGapOr(fallback: number) {
    if (!gapsOnly) {
      goTo(fallback)
      return
    }
    const incomplete = walletIncompleteSteps(profile)
    const currentId = ONBOARDING_STEPS[step]
    const idx = incomplete.findIndex((s) => s === currentId)
    const nextId = incomplete[idx + 1]
    if (nextId) {
      goTo(ONBOARDING_STEPS.indexOf(nextId))
      return
    }
    goTo(REVIEW_STEP >= 0 ? REVIEW_STEP : STEP_COUNT - 1)
  }

  const next = () => nextGapOr(Math.min(step + 1, STEP_COUNT - 1))
  const prev = () => {
    if (step <= 0) onLeave()
    else if (gapsOnly) {
      const incomplete = walletIncompleteSteps(profile)
      const currentId = ONBOARDING_STEPS[step]
      const idx = incomplete.findIndex((s) => s === currentId)
      const prevId = incomplete[idx - 1]
      if (prevId) goTo(ONBOARDING_STEPS.indexOf(prevId))
      else onLeave()
    } else goTo(step - 1)
  }
  const skip = () => next()
  const skipAll = () => goTo(REVIEW_STEP >= 0 ? REVIEW_STEP : STEP_COUNT - 1)
  const canSkipAll = step < REVIEW_STEP

  useEffect(() => {
    if (!gapsOnly) return
    const el = document.querySelector<HTMLElement>('[data-wallet-gap="true"]')
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [gapsOnly, id, profile])

  if (id === 'welcome') {
    return (
      <div className="space-y-5">
        <p className="text-lg font-medium leading-snug text-ink md:text-xl">
          {t('onboarding.welcomeBody')}
        </p>
        <StepNav
          onBack={prev}
          onContinue={next}
          onSkip={skip}
          onSkipAll={canSkipAll ? skipAll : undefined}
        />
      </div>
    )
  }

  if (id === 'otp') {
    const phoneOk = isValidMoroccanPhone(profile.phone)
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">{t('onboarding.otpHint')}</p>
        <div data-wallet-gap={gapAttr(gapsOnly, profile, 'phone')}>
          <PhoneInput
            id="otp-phone"
            label={t('onboarding.phone')}
            value={profile.phone}
            onChange={(e164) => setProfile({ phone: e164 })}
            required
            highlight={Boolean(gapAttr(gapsOnly, profile, 'phone'))}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={!phoneOk}
          onClick={() => setOtpSent(true)}
        >
          {t('onboarding.otpSend')}
        </Button>
        {otpSent || (gapsOnly && walletFieldNeedsInput(profile, 'phoneVerified')) ? (
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
              className={gapClass(gapsOnly, profile, 'phoneVerified')}
              data-wallet-gap={gapAttr(gapsOnly, profile, 'phoneVerified')}
            />
            <p className="text-xs text-ink-muted">{t('onboarding.otpMockNote')}</p>
          </div>
        ) : null}
        <StepNav
          onBack={prev}
          onSkip={skip}
          onSkipAll={canSkipAll ? skipAll : undefined}
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
    const firstOk = !profile.firstName.trim() || isPersonName(profile.firstName)
    const lastOk = !profile.lastName.trim() || isPersonName(profile.lastName)
    const cinOk = !profile.cin.trim() || isMoroccanCin(profile.cin)
    const cityOk = !profile.city.trim() || isMoroccanCity(profile.city)
    const identityOk = firstOk && lastOk && cinOk && cityOk
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t('onboarding.firstName')}</Label>
            <Input
              id="firstName"
              value={profile.firstName}
              onChange={(e) => setProfile({ firstName: e.target.value })}
              autoComplete="given-name"
              aria-invalid={!firstOk}
              className={gapClass(gapsOnly, profile, 'firstName')}
              data-wallet-gap={gapAttr(gapsOnly, profile, 'firstName')}
            />
            {!firstOk ? (
              <p className="text-sm text-alert">{t('fields.errorPersonName')}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t('onboarding.lastName')}</Label>
            <Input
              id="lastName"
              value={profile.lastName}
              onChange={(e) => setProfile({ lastName: e.target.value })}
              autoComplete="family-name"
              aria-invalid={!lastOk}
              className={gapClass(gapsOnly, profile, 'lastName')}
              data-wallet-gap={gapAttr(gapsOnly, profile, 'lastName')}
            />
            {!lastOk ? (
              <p className="text-sm text-alert">{t('fields.errorPersonName')}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cin">{t('onboarding.cin')}</Label>
          <Input
            id="cin"
            value={profile.cin}
            onChange={(e) => setProfile({ cin: normalizeCin(e.target.value) })}
            autoComplete="off"
            aria-invalid={!cinOk}
            className={gapClass(gapsOnly, profile, 'cin')}
            data-wallet-gap={gapAttr(gapsOnly, profile, 'cin')}
          />
          {!cinOk ? <p className="text-sm text-alert">{t('fields.errorCin')}</p> : null}
        </div>
        <div className="space-y-2" data-wallet-gap={gapAttr(gapsOnly, profile, 'city')}>
          <Label htmlFor="city">{t('onboarding.city')}</Label>
          <CitySelect
            id="city"
            value={profile.city}
            onChange={(city) => setProfile({ city })}
            highlight={Boolean(gapAttr(gapsOnly, profile, 'city'))}
          />
          {!cityOk ? <p className="text-sm text-alert">{t('fields.errorCity')}</p> : null}
        </div>
        <StepNav
          onBack={prev}
          onSkip={skip}
          onSkipAll={canSkipAll ? skipAll : undefined}
          onContinue={next}
          continueDisabled={!identityOk}
        />
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
            className={gapClass(gapsOnly, profile, 'licenseNumber')}
            data-wallet-gap={gapAttr(gapsOnly, profile, 'licenseNumber')}
          />
        </div>
        <StepNav onBack={prev} onSkip={skip} onSkipAll={canSkipAll ? skipAll : undefined} onContinue={next} />
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
            onChange={(e) => setProfile({ plate: e.target.value.toUpperCase() })}
            aria-invalid={Boolean(profile.plate.trim()) && !isMoroccanPlate(profile.plate)}
            className={gapClass(gapsOnly, profile, 'plate')}
            data-wallet-gap={gapAttr(gapsOnly, profile, 'plate')}
          />
          {profile.plate.trim() && !isMoroccanPlate(profile.plate) ? (
            <p className="text-sm text-alert">{t('fields.errorPlate')}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicle">{t('onboarding.vehicle')}</Label>
          <div data-wallet-gap={gapAttr(gapsOnly, profile, 'vehicle')}>
            <VehicleSelect
              id="vehicle"
              value={profile.vehicle}
              onChange={(vehicle) => setProfile({ vehicle })}
              highlight={Boolean(gapAttr(gapsOnly, profile, 'vehicle'))}
            />
          </div>
        </div>
        <StepNav
          onBack={prev}
          onSkip={skip}
          onSkipAll={canSkipAll ? skipAll : undefined}
          onContinue={() => {
            if (profile.plate.trim()) {
              setProfile({ plate: normalizePlate(profile.plate) })
            }
            next()
          }}
          continueDisabled={Boolean(profile.plate.trim()) && !isMoroccanPlate(profile.plate)}
        />
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
          <div data-wallet-gap={gapAttr(gapsOnly, profile, 'insurer')}>
            <InsurerSelect
              id="insurer"
              value={profile.insurer}
              onChange={(insurer) => setProfile({ insurer })}
              placeholder={t('onboarding.insurerPick')}
              className={gapClass(gapsOnly, profile, 'insurer')}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="policy">{t('onboarding.policy')}</Label>
          <Input
            id="policy"
            value={profile.policy}
            onChange={(e) => setProfile({ policy: e.target.value })}
            className={gapClass(gapsOnly, profile, 'policy')}
            data-wallet-gap={gapAttr(gapsOnly, profile, 'policy')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attestationValidUntil">{t('onboarding.attestationValidUntil')}</Label>
          <div data-wallet-gap={gapAttr(gapsOnly, profile, 'attestationValidUntil')}>
            <DatePicker
              id="attestationValidUntil"
              value={profile.attestationValidUntil}
              onChange={(attestationValidUntil) => setProfile({ attestationValidUntil })}
              data-testid="attestation-valid-until"
              highlight={Boolean(gapAttr(gapsOnly, profile, 'attestationValidUntil'))}
            />
          </div>
        </div>
        <ExpiryReminder validUntil={profile.attestationValidUntil} />
        <StepNav onBack={prev} onSkip={skip} onSkipAll={canSkipAll ? skipAll : undefined} onContinue={next} />
      </div>
    )
  }

  if (id === 'broker') {
    return <BrokerPickStep onBack={prev} onSkip={skip} onSkipAll={canSkipAll ? skipAll : undefined} onContinue={next} gapsOnly={gapsOnly} />
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
        <StepNav onBack={prev} onSkip={skip} onSkipAll={canSkipAll ? skipAll : undefined} onContinue={next} />
      </div>
    )
  }

  if (id === 'review') {
    const rows: Array<[string, string]> = [
      [t('onboarding.firstName'), profile.firstName || '—'],
      [t('onboarding.lastName'), profile.lastName || '—'],
      [t('onboarding.cin'), profile.cin || '—'],
      [t('onboarding.city'), profile.city || '—'],
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
  /** Resume only incomplete portefeuille steps (wallet nudge). */
  gapsOnly?: boolean
}) {
  const { t } = useTranslation()
  const { profile, completeOnboarding, error, saving, setProfile, persistDraft } =
    useProfileStore()
  const user = useSessionStore((s) => s.user)
  const [step, setStep] = useState(() => {
    if (opts.gapsOnly) {
      const gap = firstWalletGapStep(profile)
      const idx = ONBOARDING_STEPS.indexOf(gap)
      return idx >= 0 ? idx : 0
    }
    return Math.min(Math.max(profile.onboardingStep || 0, 0), STEP_COUNT - 1)
  })

  const stepId = ONBOARDING_STEPS[step] ?? 'welcome'
  const stepTitle = t(stepTitleKey(stepId))

  function goTo(n: number) {
    const clamped = Math.min(Math.max(n, 0), STEP_COUNT - 1)
    setStep(clamped)
    setProfile({ onboardingStep: clamped })
    void persistDraft()
  }

  // If gaps close while drawer open, jump to next remaining gap (or review).
  useEffect(() => {
    if (!opts.gapsOnly) return
    const gap = firstWalletGapStep(profile)
    const idx = ONBOARDING_STEPS.indexOf(gap)
    if (idx < 0 || idx === step) return
    const currentId = ONBOARDING_STEPS[step]
    const stillNeeded = walletIncompleteSteps(profile)
    if (currentId && stillNeeded.includes(currentId as (typeof stillNeeded)[number])) return
    setStep(idx)
    setProfile({ onboardingStep: idx })
  }, [opts.gapsOnly, profile, step, setProfile])

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
            // Prefer live wallet broker — JWT may lag; never wipe a pick with stale ''.
            brokerId: user.brokerId || latest.brokerId || '',
            policyId: user.policyId ?? '',
          }
        : {}),
      firstName: latest.firstName || authFirst,
      lastName: latest.lastName || authLast,
    })
  }, [user, profile.motoristId, profile.firstName, profile.lastName, setProfile])

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

/** Wizard body without Sheet chrome — embed in docked drawer / edit sheet. */
export function OnboardingWizardBody({
  onClose,
  onFinished,
  showStepTitle = true,
  showProgress = true,
  gapsOnly = false,
}: {
  onClose: () => void
  onFinished: () => void
  showStepTitle?: boolean
  /** Inline bar under title. Wallet drawer uses header-edge bar instead. */
  showProgress?: boolean
  /** Jump to incomplete portefeuille steps only. */
  gapsOnly?: boolean
}) {
  const { t } = useTranslation()
  const { stepId, stepTitle, progress, form } = useOnboardingWizard({
    onClose,
    onFinished,
    gapsOnly,
  })
  return (
    <div
      className={cn(showStepTitle ? 'space-y-5' : 'space-y-4')}
      data-testid="onboarding-wizard-body"
    >
      {showProgress ? progress : null}
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
        className="max-w-xl"
        data-testid="onboarding-edit-drawer"
      >
        {open ? (
          <OnboardingWizardBody onClose={close} onFinished={close} showStepTitle gapsOnly />
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
          <div className="mb-5 space-y-4">
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
