import { useEffect, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { InsurerSelect } from '@/components/InsurerSelect'
import { VehicleSelect } from '@/components/VehicleSelect'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StickyActions, StickyActionsProvider } from '@/components/ui/sticky-actions'
import { useProfileStore } from '@/store/profile'
import { api } from '@/services/api.ts'
import { attestationDaysRemaining, walletToDomain, type Wallet } from '@/services/wallet.ts'
import { cn } from '@/lib/utils'

type ProfileCategory = 'identite' | 'vehicule' | 'contrat' | 'courtier'
type SettingsCategory = ProfileCategory | 'compte'

const PROFILE_CATEGORIES: ProfileCategory[] = [
  'identite',
  'vehicule',
  'contrat',
  'courtier',
]

const CATEGORIES: SettingsCategory[] = [...PROFILE_CATEGORIES, 'compte']

const CATEGORY_ICON: Record<SettingsCategory, LabasIconName> = {
  identite: 'user',
  vehicule: 'car',
  contrat: 'clipboard',
  courtier: 'briefcase',
  compte: 'lock',
}

type FieldKey = keyof Pick<
  Wallet,
  | 'name'
  | 'phone'
  | 'cin'
  | 'city'
  | 'licenseNumber'
  | 'plate'
  | 'vehicle'
  | 'insurer'
  | 'policy'
  | 'attestationValidUntil'
  | 'assistanceNumber'
  | 'broker'
  | 'brokerPhone'
>

const CATEGORY_FIELDS: Record<Exclude<ProfileCategory, 'courtier'>, FieldKey[]> = {
  identite: ['name', 'phone', 'cin', 'city', 'licenseNumber'],
  vehicule: ['plate', 'vehicle'],
  contrat: ['insurer', 'policy', 'attestationValidUntil', 'assistanceNumber'],
}

const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'onboarding.name',
  phone: 'onboarding.phone',
  cin: 'onboarding.cin',
  city: 'onboarding.city',
  licenseNumber: 'onboarding.licenseNumber',
  plate: 'onboarding.plate',
  vehicle: 'onboarding.vehicle',
  insurer: 'onboarding.insurer',
  policy: 'onboarding.policy',
  attestationValidUntil: 'onboarding.attestationValidUntil',
  assistanceNumber: 'onboarding.assistance',
  broker: 'onboarding.broker',
  brokerPhone: 'onboarding.brokerPhone',
}

function isEditableCategory(
  category: SettingsCategory,
): category is Exclude<ProfileCategory, 'courtier'> {
  return category === 'identite' || category === 'vehicule' || category === 'contrat'
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="border-b border-border/50 py-3 last:border-b-0">
      <Label className="text-sm font-medium text-ink-muted">{label}</Label>
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
  const { profile, setProfile, saving, error } = useProfileStore()
  const [category, setCategory] = useState<SettingsCategory>('identite')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [persistBusy, setPersistBusy] = useState(false)
  const [brokerEmail, setBrokerEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setCategory('identite')
      setPersistError(null)
      setBrokerEmail(null)
    }
  }, [open])

  useEffect(() => {
    if (!open || !profile.brokerId) {
      setBrokerEmail(null)
      return
    }
    let cancelled = false
    void api
      .listRegisteredBrokers()
      .then((list) => {
        if (cancelled) return
        const match = list.find((b) => b.id === profile.brokerId)
        setBrokerEmail(match?.email ?? null)
      })
      .catch(() => {
        if (!cancelled) setBrokerEmail(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, profile.brokerId])

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

  const showEditableForm = isEditableCategory(category)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-50 bg-ink/40" />
        <Dialog.Content
          className={cn(
            'labas-dialog-panel fixed left-1/2 top-1/2 z-50 flex h-[min(36rem,calc(100dvh-2rem))] w-[min(52rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2',
            'overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(16,40,96,0.45)] outline-none',
          )}
          data-testid="profile-settings-modal"
        >
          <aside className="flex w-[14.5rem] shrink-0 flex-col border-r border-border/70 bg-[#faf8f3]">
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-3">
              <Dialog.Close
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-[transform,background-color] duration-150 ease-out hover:bg-sand-deep active:scale-[0.96]"
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
                    name={CATEGORY_ICON[id]}
                    className="h-5 w-5 shrink-0"
                    tone="onSand"
                    aria-hidden
                  />
                  {t(`motorist.settingsCat.${id}`)}
                </button>
              ))}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-sand/30">
            <StickyActionsProvider
              className="min-h-0 flex-1"
              bodyClassName="p-5"
              footerClassName="border-border/60 bg-sand/30 px-5"
            >
              {showEditableForm ? (
                <>
                  <h2 className="font-display text-xl font-bold text-ink">
                    {t(`motorist.settingsCat.${category}`)}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t(`motorist.settingsCatHint.${category}`)}
                  </p>

                  <div className="mt-4 rounded-[var(--radius-labas)] border border-border bg-surface px-4">
                    {CATEGORY_FIELDS[category].map((key) => (
                      <FieldRow key={key} label={t(FIELD_LABEL[key])}>
                        {key === 'insurer' ? (
                          <InsurerSelect
                            value={profile.insurer}
                            onChange={(insurer) => setProfile({ insurer })}
                            placeholder={t('onboarding.insurerPick')}
                            className="min-h-10 border-border px-3 py-2 text-base"
                          />
                        ) : key === 'vehicle' ? (
                          <VehicleSelect
                            value={profile.vehicle}
                            onChange={(vehicle) => setProfile({ vehicle })}
                            className="min-h-10 border-border px-3 py-2 text-base"
                          />
                        ) : (
                          <Input
                            type={key === 'attestationValidUntil' ? 'date' : 'text'}
                            value={profile[key]}
                            onChange={(e) => setProfile({ [key]: e.target.value })}
                            className="min-h-10 border-border px-3 py-2 text-base"
                          />
                        )}
                      </FieldRow>
                    ))}
                  </div>

                  {category === 'contrat' && days !== null && days < 0 ? (
                    <p className="mt-3 text-sm text-alert">
                      {t('onboarding.attestationExpired', {
                        date: profile.attestationValidUntil,
                      })}
                    </p>
                  ) : null}
                  {category === 'contrat' &&
                  days !== null &&
                  days >= 0 &&
                  days <= 45 ? (
                    <p className="mt-3 text-sm text-ink-muted">
                      {t('onboarding.attestationExpiryReminder', {
                        date: profile.attestationValidUntil,
                        days,
                      })}
                    </p>
                  ) : null}

                  {(persistError || error) && (
                    <p className="mt-3 text-sm text-alert">{persistError || error}</p>
                  )}

                  <StickyActions>
                    <Button
                      type="button"
                      disabled={persistBusy || saving}
                      onClick={() => void persist()}
                      data-testid="settings-save"
                    >
                      {t('app.save')}
                    </Button>
                  </StickyActions>
                </>
              ) : null}

              {category === 'courtier' ? (
                <>
                  <h2 className="font-display text-xl font-bold text-ink">
                    {t('motorist.settingsCat.courtier')}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('motorist.settingsCatHint.courtier')}
                  </p>
                  <div className="mt-4 rounded-[var(--radius-labas)] border border-border bg-surface px-4">
                    <FieldRow label={t('onboarding.broker')}>
                      <p className="min-h-10 py-2 text-base text-ink" data-testid="settings-broker-name">
                        {profile.broker.trim() || t('motorist.brokerUnset')}
                      </p>
                    </FieldRow>
                    <FieldRow label={t('onboarding.brokerEmail')}>
                      <p className="min-h-10 py-2 text-base text-ink" data-testid="settings-broker-email">
                        {brokerEmail ?? '—'}
                      </p>
                    </FieldRow>
                  </div>
                  <p className="mt-3 text-sm text-ink-muted">{t('motorist.brokerContactHint')}</p>
                </>
              ) : null}

              {category === 'compte' ? (
                <>
                  <h2 className="font-display text-xl font-bold text-ink">
                    {t('motorist.settingsCat.compte')}
                  </h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t('motorist.settingsCatHint.compte')}
                  </p>
                  <p className="mt-6 text-sm text-ink-muted">{t('motorist.settingsAccountHint')}</p>
                </>
              ) : null}
            </StickyActionsProvider>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
