import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UnsavedExitDialog } from '@/components/UnsavedExitDialog'
import { SettingsModalShell, type SettingsNavItem } from '@/components/SettingsModalShell'
import { AvatarPhotoField } from '@/features/home/AvatarPhotoField'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { CitySelect } from '@/components/CitySelect'
import { InsurerSelect } from '@/components/InsurerSelect'
import { VehicleSelect } from '@/components/VehicleSelect'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import {
  isMoroccanCin,
  isMoroccanPlate,
  isPersonName,
  normalizeCin,
  normalizePlate,
} from '@/domain/ma-fields.ts'
import { isMoroccanCity } from '@/domain/moroccan-cities.ts'
import { countryCodeToFlagEmoji, isValidMoroccanPhone } from '@/lib/phone'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'
import { api } from '@/services/api.ts'
import {
  attestationDaysRemaining,
  emptyWallet,
  type Wallet,
} from '@/services/wallet.ts'
import { cn } from '@/lib/utils'

type ProfileCategory = 'identite' | 'vehicule' | 'contrat' | 'courtier'
type SettingsCategory = 'profil' | ProfileCategory | 'general' | 'compte'

const PROFILE_CATEGORIES: ProfileCategory[] = [
  'identite',
  'vehicule',
  'contrat',
  'courtier',
]

const CATEGORIES: SettingsCategory[] = ['profil', ...PROFILE_CATEGORIES, 'general', 'compte']

const CATEGORY_ICON: Record<SettingsCategory, LabasIconName> = {
  profil: 'camera',
  identite: 'user',
  vehicule: 'car',
  contrat: 'clipboard',
  courtier: 'briefcase',
  general: 'settings',
  compte: 'lock',
}

const UI_LANGUAGES = [
  { id: 'fr' as const, label: 'Français', flag: 'fr' },
  { id: 'en' as const, label: 'English', flag: 'gb' },
]

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

const EDITABLE_FIELDS: FieldKey[] = [
  ...CATEGORY_FIELDS.identite,
  ...CATEGORY_FIELDS.vehicule,
  ...CATEGORY_FIELDS.contrat,
]

function countDraftChanges(draft: Wallet, baseline: Wallet): number {
  let n = 0
  for (const key of EDITABLE_FIELDS) {
    const a = String(draft[key] ?? '').trim()
    const b = String(baseline[key] ?? '').trim()
    if (a !== b) n += 1
  }
  const avatarLocal = String(draft.avatarPhotoLocal ?? '').trim()
  const baseAvatarLocal = String(baseline.avatarPhotoLocal ?? '').trim()
  const avatarPath = String(draft.avatarPhotoPath ?? '').trim()
  const baseAvatarPath = String(baseline.avatarPhotoPath ?? '').trim()
  if (avatarLocal !== baseAvatarLocal || avatarPath !== baseAvatarPath) n += 1
  return n
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
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div className="border-b border-border/50 py-3 last:border-b-0">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-ink-muted">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function LangFlag({ code, className }: { code: string; className?: string }) {
  const [imgBroken, setImgBroken] = useState(false)
  if (imgBroken) {
    return (
      <span className={cn('text-base leading-none', className)} aria-hidden>
        {countryCodeToFlagEmoji(code.toUpperCase())}
      </span>
    )
  }
  return (
    <img
      className={cn(
        'h-4 w-[22px] shrink-0 rounded-sm object-cover outline outline-1 outline-ink/10',
        className,
      )}
      src={`https://flagcdn.com/w40/${code}.png`}
      alt=""
      width={22}
      height={16}
      loading="lazy"
      decoding="async"
      onError={() => setImgBroken(true)}
    />
  )
}

export function ProfileSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)
  const { setProfile, persistDraft, saving, error } = useProfileStore()
  const [draft, setDraft] = useState<Wallet>(emptyWallet)
  const [baseline, setBaseline] = useState<Wallet>(emptyWallet)
  const [category, setCategory] = useState<SettingsCategory>('profil')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [persistBusy, setPersistBusy] = useState(false)
  const [brokerEmail, setBrokerEmail] = useState<string | null>(null)
  const [brokerPhone, setBrokerPhone] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  const uiLang = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
    ? 'en'
    : 'fr'

  const navItems: SettingsNavItem[] = useMemo(
    () =>
      CATEGORIES.map((id) => ({
        id,
        icon: CATEGORY_ICON[id],
        label: t(`motorist.settingsCat.${id}`),
      })),
    [t],
  )

  useEffect(() => {
    if (!open) {
      setCategory('profil')
      setPersistError(null)
      setBrokerEmail(null)
      setBrokerPhone(null)
      setDeleteConfirm(false)
      setDeleteBusy(false)
      setDeleteError(null)
      setDiscardOpen(false)
      return
    }
    // Snapshot once per open — typing stays local until Enregistrer.
    const snap = { ...useProfileStore.getState().profile }
    setDraft(snap)
    setBaseline(snap)
  }, [open])

  useEffect(() => {
    if (category !== 'compte') {
      setDeleteConfirm(false)
      setDeleteError(null)
    }
  }, [category])

  async function confirmDeleteAccount() {
    if (deleteBusy) return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await api.deleteAccount()
      signOut()
      onOpenChange(false)
      navigate('/', { replace: true })
    } catch {
      setDeleteError(t('motorist.deleteAccountError'))
      setDeleteBusy(false)
    }
  }

  useEffect(() => {
    if (!open || !draft.brokerId) {
      setBrokerEmail(null)
      setBrokerPhone(null)
      return
    }
    let cancelled = false
    void api
      .listRegisteredBrokers()
      .then((list) => {
        if (cancelled) return
        const match = list.find((b) => b.id === draft.brokerId)
        setBrokerEmail(match?.email ?? null)
        setBrokerPhone(match?.phone ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setBrokerEmail(null)
          setBrokerPhone(null)
        }
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
    if (!draftSaveOk(draft) || countDraftChanges(draft, baseline) === 0) return
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
      setDraft(next)
      setBaseline(next)
    } catch {
      setPersistError(t('onboarding.saveError'))
    } finally {
      setPersistBusy(false)
    }
  }

  function requestClose() {
    if (persistBusy || deleteBusy) return
    if (countDraftChanges(draft, baseline) > 0) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  function discardAndClose() {
    setDraft(baseline)
    setDiscardOpen(false)
    onOpenChange(false)
  }

  const showEditableForm = isEditableCategory(category)
  const showProfil = category === 'profil'
  const showSaveBar = showEditableForm || showProfil
  const changeCount = countDraftChanges(draft, baseline)
  const canSave = draftSaveOk(draft) && changeCount > 0

  return (
    <>
      <SettingsModalShell
        open={open}
        title={t('motorist.settingsTitle')}
        testId="profile-settings-modal"
        categories={navItems}
        category={category}
        onCategoryChange={(id) => setCategory(id as SettingsCategory)}
        onRequestClose={requestClose}
        blockDismiss={discardOpen || changeCount > 0}
        onBlockedDismiss={() => {
          if (!discardOpen) setDiscardOpen(true)
        }}
        showSaveBar={showSaveBar}
        canSave={canSave}
        changeCount={changeCount}
        persistBusy={persistBusy || saving}
        onSave={() => void persist()}
      >
        {showProfil ? (
          <>
            <h2 className="font-display text-xl font-bold text-ink">
              {t('motorist.settingsCat.profil')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t('motorist.settingsCatHint.profil')}
            </p>
            <div className="mt-4 rounded-[var(--radius-labas)] border border-border bg-surface p-4">
              <AvatarPhotoField
                value={draft.avatarPhotoLocal}
                onChange={(next) =>
                  patchDraft({
                    avatarPhotoLocal: next,
                    ...(next ? {} : { avatarPhotoPath: '' }),
                  })
                }
              />
            </div>
            {(persistError || error) && (
              <p className="mt-3 text-sm text-alert">{persistError || error}</p>
            )}
          </>
        ) : null}

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
              <FieldRow label={t('onboarding.brokerPhone')}>
                <p className="min-h-10 py-2 text-base text-ink" data-testid="settings-broker-phone">
                  {brokerPhone?.trim() || '—'}
                </p>
              </FieldRow>
            </div>
            <p className="mt-3 text-sm text-ink-muted">{t('motorist.brokerContactHint')}</p>
          </>
        ) : null}

        {category === 'general' ? (
          <>
            <h2 className="font-display text-xl font-bold text-ink">
              {t('motorist.settingsCat.general')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              {t('motorist.settingsCatHint.general')}
            </p>
            <div className="mt-6 rounded-[var(--radius-labas)] border border-border bg-surface p-4">
              <p
                id="settings-language-label"
                className="text-sm font-medium text-ink-muted"
              >
                {t('motorist.settingsLanguage')}
              </p>
              <div
                className="mt-3 flex flex-col gap-2"
                role="radiogroup"
                aria-labelledby="settings-language-label"
                data-testid="settings-language"
              >
                {UI_LANGUAGES.map((lang) => {
                  const selected = uiLang === lang.id
                  return (
                    <button
                      key={lang.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`settings-language-${lang.id}`}
                      onClick={() => {
                        void i18n.changeLanguage(lang.id)
                      }}
                      className={cn(
                        'flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-labas)] border-2 px-4 py-3 text-left text-base font-medium transition-colors',
                        selected
                          ? 'border-ink bg-ink-soft text-ink'
                          : 'border-border bg-surface text-ink hover:border-ink/40',
                      )}
                    >
                      <LangFlag code={lang.flag} />
                      <span className="min-w-0 flex-1">{lang.label}</span>
                      <span
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          selected ? 'border-ink bg-ink' : 'border-border',
                        )}
                        aria-hidden
                      >
                        {selected ? (
                          <span className="h-2 w-2 rounded-full bg-sand" />
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
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
            <div className="mt-6 rounded-[var(--radius-labas)] border border-alert/30 bg-alert-soft p-4">
              <p className="text-sm font-medium text-ink">{t('motorist.deleteAccountTitle')}</p>
              <p className="mt-1 text-sm text-ink-muted">{t('motorist.deleteAccountBody')}</p>
              {deleteError ? (
                <p className="mt-2 text-sm text-alert" role="alert">
                  {deleteError}
                </p>
              ) : null}
              {!deleteConfirm ? (
                <Button
                  type="button"
                  variant="softAlert"
                  size="icon"
                  className="mt-4"
                  title={t('motorist.deleteAccount')}
                  aria-label={t('motorist.deleteAccount')}
                  data-testid="settings-delete-account"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <LabasIcon name="trash" tone="alert" className="h-5 w-5" aria-hidden />
                </Button>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deleteBusy}
                    onClick={() => {
                      setDeleteConfirm(false)
                      setDeleteError(null)
                    }}
                  >
                    {t('app.close')}
                  </Button>
                  <Button
                    type="button"
                    variant="alert"
                    disabled={deleteBusy}
                    data-testid="settings-delete-account-confirm"
                    onClick={() => void confirmDeleteAccount()}
                  >
                    {deleteBusy
                      ? t('motorist.deleteAccountBusy')
                      : t('motorist.deleteAccountConfirm')}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </SettingsModalShell>
      <UnsavedExitDialog
        open={discardOpen}
        onStay={() => setDiscardOpen(false)}
        onDiscard={discardAndClose}
      />
    </>
  )
}
