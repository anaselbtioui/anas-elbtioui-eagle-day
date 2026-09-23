import { useEffect, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { CitySelect } from '@/components/CitySelect'
import { InsurerSelect } from '@/components/InsurerSelect'
import { VehicleSelect } from '@/components/VehicleSelect'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { StickyActions, StickyActionsProvider } from '@/components/ui/sticky-actions'
import {
  isMoroccanCin,
  isMoroccanPlate,
  isPersonName,
  normalizeCin,
  normalizePlate,
} from '@/domain/ma-fields.ts'
import { isMoroccanCity } from '@/domain/moroccan-cities.ts'
import { isValidMoroccanPhone } from '@/lib/phone'
import { useProfileStore } from '@/store/profile'
import { api } from '@/services/api.ts'
import {
  attestationDaysRemaining,
  emptyWallet,
  type Wallet,
} from '@/services/wallet.ts'
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
  | 'firstName'
  | 'lastName'
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
  identite: ['firstName', 'lastName', 'phone', 'cin', 'city', 'licenseNumber'],
  vehicule: ['plate', 'vehicle'],
  contrat: ['insurer', 'policy', 'attestationValidUntil', 'assistanceNumber'],
}

const FIELD_LABEL: Record<FieldKey, string> = {
  firstName: 'onboarding.firstName',
  lastName: 'onboarding.lastName',
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

function fieldErrorKey(draft: Wallet, key: FieldKey): string | null {
  const raw = String(draft[key] ?? '').trim()
  if (!raw) return null
  switch (key) {
    case 'firstName':
    case 'lastName':
      return isPersonName(raw) ? null : 'fields.errorPersonName'
    case 'cin':
      return isMoroccanCin(raw) ? null : 'fields.errorCin'
    case 'city':
      return isMoroccanCity(raw) ? null : 'fields.errorCity'
    case 'plate':
      return isMoroccanPlate(raw) ? null : 'fields.errorPlate'
    case 'phone':
      return isValidMoroccanPhone(raw) ? null : 'phone.invalid'
    default:
      return null
  }
}

function draftSaveOk(draft: Wallet): boolean {
  if (draft.firstName.trim() && !isPersonName(draft.firstName)) return false
  if (draft.lastName.trim() && !isPersonName(draft.lastName)) return false
  if (draft.cin.trim() && !isMoroccanCin(draft.cin)) return false
  if (draft.city.trim() && !isMoroccanCity(draft.city)) return false
  if (draft.plate.trim() && !isMoroccanPlate(draft.plate)) return false
  if (draft.phone.trim() && !isValidMoroccanPhone(draft.phone)) return false
  return true
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
  const { setProfile, persistDraft, saving, error } = useProfileStore()
  const [draft, setDraft] = useState<Wallet>(emptyWallet)
  const [category, setCategory] = useState<SettingsCategory>('identite')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [persistBusy, setPersistBusy] = useState(false)
  const [brokerEmail, setBrokerEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setCategory('identite')
      setPersistError(null)
      setBrokerEmail(null)
      return
    }
    // Snapshot once per open — typing stays local until Enregistrer.
    setDraft({ ...useProfileStore.getState().profile })
  }, [open])

  useEffect(() => {
    if (!open || !draft.brokerId) {
      setBrokerEmail(null)
      return
    }
    let cancelled = false
    void api
      .listRegisteredBrokers()
      .then((list) => {
        if (cancelled) return
        const match = list.find((b) => b.id === draft.brokerId)
        setBrokerEmail(match?.email ?? null)
      })
      .catch(() => {
        if (!cancelled) setBrokerEmail(null)
      })
    return () => {
      cancelled = true
    }
  }, [open, draft.brokerId])

  const days = attestationDaysRemaining(draft.attestationValidUntil)

  function patchDraft(patch: Partial<Wallet>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  async function persist() {
    if (!draftSaveOk(draft)) return
    setPersistBusy(true)
    setPersistError(null)
    try {
      const next = {
        ...draft,
        cin: draft.cin.trim() ? normalizeCin(draft.cin) : '',
        plate: draft.plate.trim() ? normalizePlate(draft.plate) : '',
      }
      setProfile(next)
      await persistDraft()
      onOpenChange(false)
    } catch {
      setPersistError(t('onboarding.saveError'))
    } finally {
      setPersistBusy(false)
    }
  }

  const showEditableForm = isEditableCategory(category)
  const canSave = draftSaveOk(draft)

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
                    {CATEGORY_FIELDS[category].map((key) => {
                      const errKey = fieldErrorKey(draft, key)
                      return (
                      <FieldRow key={key} label={t(FIELD_LABEL[key])}>
                        {key === 'insurer' ? (
                          <InsurerSelect
                            value={draft.insurer}
                            onChange={(insurer) => patchDraft({ insurer })}
                            placeholder={t('onboarding.insurerPick')}
                            className="min-h-10 border-border px-3 py-2 text-base"
                          />
                        ) : key === 'vehicle' ? (
                          <VehicleSelect
                            value={draft.vehicle}
                            onChange={(vehicle) => patchDraft({ vehicle })}
                            className="min-h-10 border-border px-3 py-2 text-base"
                          />
                        ) : key === 'city' ? (
                          <CitySelect
                            value={draft.city}
                            onChange={(city) => patchDraft({ city })}
                            className="min-h-10"
                          />
                        ) : key === 'phone' ? (
                          <PhoneInput
                            value={draft.phone}
                            onChange={(phone) => patchDraft({ phone })}
                            className="min-h-10"
                          />
                        ) : key === 'attestationValidUntil' ? (
                          <DatePicker
                            value={draft.attestationValidUntil}
                            onChange={(attestationValidUntil) =>
                              patchDraft({ attestationValidUntil })
                            }
                            className="min-h-10 [&_button]:min-h-10 [&_button]:px-3 [&_button]:py-2"
                            aria-invalid={Boolean(errKey)}
                            data-testid="settings-attestation-valid-until"
                          />
                        ) : (
                          <Input
                            type="text"
                            value={draft[key]}
                            onChange={(e) => {
                              const v = e.target.value
                              if (key === 'cin') patchDraft({ cin: normalizeCin(v) })
                              else if (key === 'plate') patchDraft({ plate: v.toUpperCase() })
                              else patchDraft({ [key]: v })
                            }}
                            className="min-h-10 border-border px-3 py-2 text-base"
                            aria-invalid={Boolean(errKey)}
                          />
                        )}
                        {errKey ? (
                          <p className="mt-1 text-sm text-alert">{t(errKey)}</p>
                        ) : null}
                      </FieldRow>
                      )
                    })}
                  </div>

                  {category === 'contrat' && days !== null && days < 0 ? (
                    <p className="mt-3 text-sm text-alert">
                      {t('onboarding.attestationExpired', {
                        date: draft.attestationValidUntil,
                      })}
                    </p>
                  ) : null}
                  {category === 'contrat' &&
                  days !== null &&
                  days >= 0 &&
                  days <= 45 ? (
                    <p className="mt-3 text-sm text-ink-muted">
                      {t('onboarding.attestationExpiryReminder', {
                        date: draft.attestationValidUntil,
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
                      loading={persistBusy || saving}
                      disabled={!canSave}
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
                        {draft.broker.trim() || t('motorist.brokerUnset')}
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
