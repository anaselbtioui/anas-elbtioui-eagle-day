import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { UnsavedExitDialog } from '@/components/UnsavedExitDialog'
import { AvatarPhotoField } from '@/features/home/AvatarPhotoField'
import { LabasIcon } from '@/components/LabasIcon'
import { SettingsModalShell, type SettingsNavItem } from '@/components/SettingsModalShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhoneInput } from '@/components/ui/phone-input'
import { isPersonName } from '@/domain/ma-fields.ts'
import { countryCodeToFlagEmoji, isValidMoroccanPhone } from '@/lib/phone'
import {
  brokerDraftSaveOk,
  countBrokerDraftChanges,
  emptyBrokerDraft,
  type BrokerProfileDraft,
  useBrokerProfileStore,
} from '@/store/brokerProfile'
import { useSessionStore } from '@/store/session'
import { api } from '@/services/api.ts'
import { cn } from '@/lib/utils'

type BrokerCategory = 'profil' | 'identite' | 'general' | 'compte'

const CATEGORIES: BrokerCategory[] = ['profil', 'identite', 'general', 'compte']

const UI_LANGUAGES = [
  { id: 'fr' as const, label: 'Français', flag: 'fr' },
  { id: 'en' as const, label: 'English', flag: 'gb' },
]

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 py-3 last:border-b-0">
      <Label className="text-sm font-medium text-ink-muted">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function LangFlag({ code }: { code: string }) {
  return (
    <span className="text-base leading-none" aria-hidden>
      {countryCodeToFlagEmoji(code)}
    </span>
  )
}

export function BrokerSettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const signOut = useSessionStore((s) => s.signOut)
  const persistDraft = useBrokerProfileStore((s) => s.persistDraft)
  const saving = useBrokerProfileStore((s) => s.saving)
  const error = useBrokerProfileStore((s) => s.error)
  const [draft, setDraft] = useState<BrokerProfileDraft>(emptyBrokerDraft)
  const [baseline, setBaseline] = useState<BrokerProfileDraft>(emptyBrokerDraft)
  const [category, setCategory] = useState<BrokerCategory>('profil')
  const [persistError, setPersistError] = useState<string | null>(null)
  const [persistBusy, setPersistBusy] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const uiLang = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
    ? 'en'
    : 'fr'

  const navItems: SettingsNavItem[] = useMemo(
    () =>
      CATEGORIES.map((id) => ({
        id,
        icon:
          id === 'profil'
            ? 'camera'
            : id === 'identite'
              ? 'user'
              : id === 'general'
                ? 'settings'
                : 'lock',
        label: t(`broker.settingsCat.${id}`),
      })),
    [t],
  )

  useEffect(() => {
    if (!open) {
      setCategory('profil')
      setPersistError(null)
      setDiscardOpen(false)
      setDeleteConfirm(false)
      setDeleteBusy(false)
      setDeleteError(null)
      return
    }
    const snap = { ...useBrokerProfileStore.getState().profile }
    setDraft(snap)
    setBaseline(snap)
  }, [open])

  useEffect(() => {
    if (category !== 'compte') {
      setDeleteConfirm(false)
      setDeleteError(null)
    }
  }, [category])

  function patchDraft(patch: Partial<BrokerProfileDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  async function persist() {
    if (!brokerDraftSaveOk(draft) || countBrokerDraftChanges(draft, baseline) === 0) return
    setPersistBusy(true)
    setPersistError(null)
    try {
      useBrokerProfileStore.getState().replaceDraft(draft)
      const next = await persistDraft()
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
    if (countBrokerDraftChanges(draft, baseline) > 0) {
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

  const changeCount = countBrokerDraftChanges(draft, baseline)
  const canSave =
    (category === 'profil' || category === 'identite') &&
    brokerDraftSaveOk(draft) &&
    changeCount > 0
  const showSaveBar = category === 'profil' || category === 'identite'

  return (
    <>
      <SettingsModalShell
        open={open}
        title={t('motorist.settingsTitle')}
        testId="broker-settings-modal"
        categories={navItems}
        category={category}
        onCategoryChange={(id) => setCategory(id as BrokerCategory)}
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
        {category === 'profil' ? (
          <>
            <h2 className="font-display text-xl font-bold text-ink">
              {t('broker.settingsCat.profil')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('broker.settingsCatHint.profil')}</p>
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

        {category === 'identite' ? (
          <>
            <h2 className="font-display text-xl font-bold text-ink">
              {t('broker.settingsCat.identite')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('broker.settingsCatHint.identite')}</p>
            <div className="mt-4 rounded-[var(--radius-labas)] border border-border bg-surface px-4">
              <FieldRow label={t('auth.firstName')}>
                <Input
                  value={draft.firstName}
                  onChange={(e) => patchDraft({ firstName: e.target.value })}
                  className="min-h-10 border-border px-3 py-2 text-base"
                  data-testid="broker-settings-first-name"
                  aria-invalid={
                    draft.firstName.trim() !== '' && !isPersonName(draft.firstName)
                      ? true
                      : undefined
                  }
                />
              </FieldRow>
              <FieldRow label={t('auth.lastName')}>
                <Input
                  value={draft.lastName}
                  onChange={(e) => patchDraft({ lastName: e.target.value })}
                  className="min-h-10 border-border px-3 py-2 text-base"
                  data-testid="broker-settings-last-name"
                  aria-invalid={
                    draft.lastName.trim() !== '' && !isPersonName(draft.lastName)
                      ? true
                      : undefined
                  }
                />
              </FieldRow>
              <FieldRow label={t('onboarding.phone')}>
                <PhoneInput
                  value={draft.phone}
                  onChange={(phone) => patchDraft({ phone })}
                  className="min-h-10"
                />
                {draft.phone.trim() && !isValidMoroccanPhone(draft.phone) ? (
                  <p className="mt-1 text-sm text-alert">{t('onboarding.phoneInvalid')}</p>
                ) : null}
              </FieldRow>
              <FieldRow label={t('auth.email')}>
                <p className="min-h-10 py-2 text-base text-ink" data-testid="broker-settings-email">
                  {draft.email || '—'}
                </p>
              </FieldRow>
            </div>
            {(persistError || error) && (
              <p className="mt-3 text-sm text-alert">{persistError || error}</p>
            )}
          </>
        ) : null}

        {category === 'general' ? (
          <>
            <h2 className="font-display text-xl font-bold text-ink">
              {t('broker.settingsCat.general')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('broker.settingsCatHint.general')}</p>
            <div className="mt-6 rounded-[var(--radius-labas)] border border-border bg-surface p-4">
              <p id="broker-settings-language-label" className="text-sm font-medium text-ink-muted">
                {t('motorist.settingsLanguage')}
              </p>
              <div
                className="mt-3 flex flex-col gap-2"
                role="radiogroup"
                aria-labelledby="broker-settings-language-label"
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
                        {selected ? <span className="h-2 w-2 rounded-full bg-sand" /> : null}
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
              {t('broker.settingsCat.compte')}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{t('broker.settingsCatHint.compte')}</p>
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
