import { useEffect, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OnboardingWizardBody } from '@/features/onboarding/OnboardingPage'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { api } from '@/services/api.ts'
import { attestationDaysRemaining, walletToDomain } from '@/services/wallet.ts'
import { cn } from '@/lib/utils'

type SettingsCategory = 'portefeuille' | 'compte'

const CATEGORIES: SettingsCategory[] = ['portefeuille', 'compte']

function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="border-b border-border/50 py-3 last:border-b-0">
      <Label className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { profile, setProfile, reset, saving, error } = useProfileStore()
  const resetAll = useEvidenceStore((s) => s.resetAll)
  const [category, setCategory] = useState<SettingsCategory>('portefeuille')
  const [editWizard, setEditWizard] = useState(false)
  const [persistError, setPersistError] = useState<string | null>(null)
  const [persistBusy, setPersistBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setCategory('portefeuille')
      setEditWizard(false)
      setPersistError(null)
    }
  }, [open])

  const days = attestationDaysRemaining(profile.attestationValidUntil)

  async function persist() {
    setPersistBusy(true)
    setPersistError(null)
    try {
      await api.saveProfile(walletToDomain(profile))
      onOpenChange(false)
    } catch {
      setPersistError(t('onboarding.saveError'))
    } finally {
      setPersistBusy(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex h-[min(36rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2',
            'overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(16,40,96,0.45)] outline-none',
          )}
          data-testid="profile-settings-modal"
        >
          <aside className="flex w-[13.5rem] shrink-0 flex-col border-r border-border/70 bg-[#faf8f3]">
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-3">
              <Dialog.Close
                className="rounded-full p-2 text-ink-muted hover:bg-sand-deep"
                aria-label={t('app.close')}
              >
                <LabasIcon name="close" className="h-5 w-5" aria-hidden />
              </Dialog.Close>
              <Dialog.Title className="font-display text-sm font-bold text-ink">
                {t('motorist.settingsTitle')}
              </Dialog.Title>
            </div>
            <nav className="labas-scroll flex-1 space-y-0.5 overflow-y-auto p-2">
              {CATEGORIES.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCategory(id)
                    setEditWizard(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[var(--radius-labas)] px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                    category === id
                      ? 'bg-ink-soft text-ink outline outline-1 outline-ink/20'
                      : 'text-ink-muted hover:bg-sand-deep/80 hover:text-ink',
                  )}
                  data-testid={`settings-cat-${id}`}
                >
                  <LabasIcon
                    name={id === 'portefeuille' ? 'clipboard' : 'user'}
                    className="h-5 w-5 shrink-0"
                    tone="onSand"
                    aria-hidden
                  />
                  {t(`motorist.settingsCat.${id}`)}
                </button>
              ))}
            </nav>
          </aside>

          <div className="labas-scroll flex min-w-0 flex-1 flex-col overflow-y-auto bg-sand/30 p-5">
            {category === 'portefeuille' && !editWizard ? (
              <>
                <h2 className="font-display text-xl font-bold text-ink">
                  {t('home.walletTitle')}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">{t('motorist.settingsLocalNote')}</p>

                <div className="mt-4 rounded-[var(--radius-labas)] border border-border bg-surface px-4">
                  <FieldRow label={t('onboarding.name')}>
                    <Input
                      value={profile.name}
                      onChange={(e) => setProfile({ name: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.phone')}>
                    <Input
                      value={profile.phone}
                      onChange={(e) => setProfile({ phone: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.cin')}>
                    <Input
                      value={profile.cin}
                      onChange={(e) => setProfile({ cin: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.plate')}>
                    <Input
                      value={profile.plate}
                      onChange={(e) => setProfile({ plate: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.vehicle')}>
                    <Input
                      value={profile.vehicle}
                      onChange={(e) => setProfile({ vehicle: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.insurer')}>
                    <Input
                      value={profile.insurer}
                      onChange={(e) => setProfile({ insurer: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.policy')}>
                    <Input
                      value={profile.policy}
                      onChange={(e) => setProfile({ policy: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.broker')}>
                    <Input
                      value={profile.broker}
                      onChange={(e) => setProfile({ broker: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.brokerPhone')}>
                    <Input
                      value={profile.brokerPhone}
                      onChange={(e) => setProfile({ brokerPhone: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.assistance')}>
                    <Input
                      value={profile.assistanceNumber}
                      onChange={(e) => setProfile({ assistanceNumber: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.city')}>
                    <Input
                      value={profile.city}
                      onChange={(e) => setProfile({ city: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                  <FieldRow label={t('onboarding.attestationValidUntil')}>
                    <Input
                      type="date"
                      value={profile.attestationValidUntil}
                      onChange={(e) => setProfile({ attestationValidUntil: e.target.value })}
                      className="min-h-10 border-border px-3 py-2 text-base"
                    />
                  </FieldRow>
                </div>

                {days !== null && days < 0 ? (
                  <p className="mt-3 text-sm text-alert">
                    {t('onboarding.attestationExpired', { date: profile.attestationValidUntil })}
                  </p>
                ) : null}

                {(persistError || error) && (
                  <p className="mt-3 text-sm text-alert">{persistError || error}</p>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={persistBusy || saving}
                    onClick={() => void persist()}
                    data-testid="settings-save"
                  >
                    {t('app.save')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditWizard(true)}
                    data-testid="settings-edit"
                  >
                    {t('motorist.settingsEdit')}
                  </Button>
                </div>
              </>
            ) : null}

            {category === 'portefeuille' && editWizard ? (
              <div>
                <button
                  type="button"
                  className="mb-3 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
                  onClick={() => setEditWizard(false)}
                >
                  ← {t('app.back')}
                </button>
                <OnboardingWizardBody
                  onClose={() => setEditWizard(false)}
                  onFinished={() => {
                    setEditWizard(false)
                    onOpenChange(false)
                  }}
                  showStepTitle
                />
              </div>
            ) : null}

            {category === 'compte' ? (
              <>
                <h2 className="font-display text-xl font-bold text-ink">
                  {t('motorist.settingsCat.compte')}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">{t('motorist.settingsAccountHint')}</p>
                <Button
                  className="mt-6"
                  variant="outline"
                  type="button"
                  data-testid="settings-reset"
                  onClick={() => {
                    if (confirm(t('app.resetProfile'))) {
                      reset()
                      resetAll()
                      onOpenChange(false)
                    }
                  }}
                >
                  {t('app.resetProfile')}
                </Button>
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Gear next to avatar — opens profile settings modal. */
export function AvatarSettingsButton({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full p-2 text-ink-muted transition-colors hover:bg-sand-deep hover:text-ink',
        className,
      )}
      aria-label={t('motorist.settingsTitle')}
      data-testid="avatar-settings"
    >
      <Settings className="h-4 w-4" strokeWidth={2.25} aria-hidden />
    </button>
  )
}
