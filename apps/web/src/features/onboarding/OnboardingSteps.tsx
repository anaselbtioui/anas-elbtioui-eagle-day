import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CitySelect } from '@/components/CitySelect'
import { InsurerSelect } from '@/components/InsurerSelect'
import { VehicleSelect } from '@/components/VehicleSelect'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { isMoroccanCin, isMoroccanPlate, isPersonName, normalizeCin, normalizePlate } from '@/domain/ma-fields.ts'
import { isMoroccanCity } from '@/domain/moroccan-cities.ts'
import { isValidMoroccanPhone } from '@/lib/phone'
import { BrokerPickStep } from '@/features/onboarding/BrokerPickStep'
import { ExpiryReminder } from '@/features/onboarding/ExpiryReminder'
import { gapAttr, gapClass } from '@/features/onboarding/gap-styles'
import { StepNav } from '@/features/onboarding/StepNav'
import { LocalPhotoField } from '@/features/onboarding/LocalPhotoField'
import {
  ONBOARDING_STEPS,
  REVIEW_STEP,
  STEP_COUNT,
} from '@/features/onboarding/steps'
import {
  attestationDaysRemaining,
  WALLET_GAP_STEPS,
  walletIncompleteSteps,
  type WalletGapStepId,
} from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile'

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
  const { profile, setProfile, persistDraft } = useProfileStore()
  const id = ONBOARDING_STEPS[Math.min(Math.max(step, 0), STEP_COUNT - 1)]

  function patchProfile(patch: Parameters<typeof setProfile>[0]) {
    setProfile(patch)
    void persistDraft()
  }

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
    if (step <= 0) {
      onLeave()
      return
    }
    if (!gapsOnly) {
      goTo(step - 1)
      return
    }
    // Gaps resume: walk prior wallet steps (filled ones too), not only incomplete.
    const currentId = ONBOARDING_STEPS[step]
    const gapIdx = (WALLET_GAP_STEPS as readonly string[]).indexOf(currentId)
    if (gapIdx > 0) {
      goTo(ONBOARDING_STEPS.indexOf(WALLET_GAP_STEPS[gapIdx - 1] as WalletGapStepId))
      return
    }
    if (gapIdx === 0) {
      onLeave()
      return
    }
    // review / assistance / etc — last wallet gap step
    goTo(ONBOARDING_STEPS.indexOf(WALLET_GAP_STEPS[WALLET_GAP_STEPS.length - 1]!))
  }
  const skip = () => next()
  const skipAll = () => goTo(REVIEW_STEP >= 0 ? REVIEW_STEP : STEP_COUNT - 1)
  const canSkipAll = step < REVIEW_STEP

  useEffect(() => {
    if (!gapsOnly) return
    const active = document.activeElement
    if (active instanceof HTMLElement && active.closest('[data-testid="wallet-nudge-drawer"]')) {
      // Already typing in the drawer — don't steal focus on every profile tick.
      if (
        active.matches('input, textarea, select, button, [contenteditable="true"]') ||
        active.getAttribute('role') === 'combobox'
      ) {
        return
      }
    }
    const el = document.querySelector<HTMLElement>('[data-wallet-gap="true"]')
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [gapsOnly, id])

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
            onChange={(e164) => patchProfile({ phone: e164, phoneVerified: false })}
            required
            highlight={Boolean(gapAttr(gapsOnly, profile, 'phone'))}
          />
        </div>
        <StepNav
          onBack={prev}
          onSkip={skip}
          onSkipAll={canSkipAll ? skipAll : undefined}
          continueDisabled={!phoneOk}
          onContinue={() => {
            // Phase 1: no SMS — valid number counts as accepted.
            patchProfile({ phoneVerified: true })
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
              onChange={(e) => patchProfile({ firstName: e.target.value })}
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
              onChange={(e) => patchProfile({ lastName: e.target.value })}
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
            onChange={(e) => patchProfile({ cin: normalizeCin(e.target.value) })}
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
            onChange={(city) => patchProfile({ city })}
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
          onChange={(licensePhotoLocal) => patchProfile({ licensePhotoLocal })}
        />
        <div className="space-y-2">
          <Label htmlFor="licenseNumber">{t('onboarding.licenseNumber')}</Label>
          <Input
            id="licenseNumber"
            value={profile.licenseNumber}
            onChange={(e) => patchProfile({ licenseNumber: e.target.value })}
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
          onChange={(carteGrisePhotoLocal) => patchProfile({ carteGrisePhotoLocal })}
        />
        <div className="space-y-2">
          <Label htmlFor="plate">{t('onboarding.plate')}</Label>
          <Input
            id="plate"
            value={profile.plate}
            onChange={(e) => patchProfile({ plate: e.target.value.toUpperCase() })}
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
              onChange={(vehicle) => patchProfile({ vehicle })}
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
              patchProfile({ plate: normalizePlate(profile.plate) })
            }
            next()
          }}
          continueDisabled={Boolean(profile.plate.trim()) && !isMoroccanPlate(profile.plate)}
        />
      </div>
    )
  }

  if (id === 'attestation') {
    const days = attestationDaysRemaining(profile.attestationValidUntil)
    const attestationNotExpired = days === null || days >= 0
    return (
      <div className="space-y-4">
        <LocalPhotoField
          label={t('onboarding.attestationPhoto')}
          hint={t('onboarding.photoLocalOnly')}
          value={profile.attestationPhotoLocal}
          onChange={(attestationPhotoLocal) => patchProfile({ attestationPhotoLocal })}
        />
        <div className="space-y-2">
          <Label htmlFor="insurer">{t('onboarding.insurer')}</Label>
          <div data-wallet-gap={gapAttr(gapsOnly, profile, 'insurer')}>
            <InsurerSelect
              id="insurer"
              value={profile.insurer}
              onChange={(insurer) => patchProfile({ insurer })}
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
            onChange={(e) => patchProfile({ policy: e.target.value })}
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
              onChange={(attestationValidUntil) => patchProfile({ attestationValidUntil })}
              data-testid="attestation-valid-until"
              highlight={Boolean(gapAttr(gapsOnly, profile, 'attestationValidUntil'))}
            />
          </div>
        </div>
        <ExpiryReminder validUntil={profile.attestationValidUntil} />
        <StepNav
          onBack={prev}
          onSkip={attestationNotExpired ? skip : undefined}
          onSkipAll={attestationNotExpired && canSkipAll ? skipAll : undefined}
          onContinue={next}
          continueDisabled={!attestationNotExpired}
        />
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
            onChange={(e) => patchProfile({ assistanceNumber: e.target.value })}
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
