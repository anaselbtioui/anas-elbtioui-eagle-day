import { useTranslation } from 'react-i18next'
import { attestationDaysRemaining } from '@/services/wallet.ts'

export function ExpiryReminder({ validUntil }: { validUntil: string }) {
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
