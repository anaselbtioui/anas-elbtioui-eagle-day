import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { OnboardingEditSheet } from '@/features/onboarding/OnboardingPage'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { attestationDaysRemaining } from '@/services/wallet.ts'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/50 py-3 last:border-b-0">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-1 text-base text-ink">{value.trim() || '—'}</p>
    </div>
  )
}

type SettingsLocationState = { editProfile?: boolean }

export function SettingsPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { profile, reset } = useProfileStore()
  const resetAll = useEvidenceStore((s) => s.resetAll)
  const editFromNav = Boolean((location.state as SettingsLocationState | null)?.editProfile)
  const [editOpen, setEditOpen] = useState(editFromNav)

  useEffect(() => {
    if (editFromNav) setEditOpen(true)
  }, [editFromNav])

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  const days = attestationDaysRemaining(profile.attestationValidUntil)

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          {t('motorist.settingsTitle')}
        </h1>
      </header>

      <Card className="border-border bg-surface/90" data-testid="settings-profile">
        <CardTitle className="text-base">{t('home.walletTitle')}</CardTitle>
        <CardDescription>{t('motorist.settingsLocalNote')}</CardDescription>

        <div className="mt-4">
          <Field label={t('onboarding.name')} value={profile.name} />
          <Field label={t('onboarding.phone')} value={profile.phone} />
          <Field label={t('onboarding.cin')} value={profile.cin} />
          <Field label={t('onboarding.plate')} value={profile.plate} />
          <Field label={t('onboarding.vehicle')} value={profile.vehicle} />
          <Field label={t('onboarding.insurer')} value={profile.insurer} />
          <Field label={t('onboarding.policy')} value={profile.policy} />
          <Field label={t('onboarding.broker')} value={profile.broker} />
          <Field label={t('onboarding.assistance')} value={profile.assistanceNumber} />
          <Field label={t('onboarding.city')} value={profile.city} />
          <Field
            label={t('onboarding.attestationValidUntil')}
            value={profile.attestationValidUntil}
          />
        </div>

        {days !== null && days < 0 ? (
          <p className="mt-3 text-sm text-alert">
            {t('onboarding.attestationExpired', { date: profile.attestationValidUntil })}
          </p>
        ) : null}
        {days !== null && days >= 0 && days <= 45 ? (
          <p className="mt-3 text-sm text-ink-muted">
            {t('onboarding.attestationExpiryReminder', {
              date: profile.attestationValidUntil,
              days,
            })}
          </p>
        ) : null}

        <Button
          className="mt-5 w-full sm:w-auto"
          variant="moss"
          type="button"
          data-testid="settings-edit"
          onClick={() => setEditOpen(true)}
        >
          {t('motorist.settingsEdit')}
        </Button>
      </Card>

      <button
        type="button"
        className="text-sm text-ink-muted"
        data-testid="settings-reset"
        onClick={() => {
          if (confirm(t('app.resetProfile'))) {
            reset()
            resetAll()
          }
        }}
      >
        {t('app.resetProfile')}
      </button>

      <OnboardingEditSheet open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
