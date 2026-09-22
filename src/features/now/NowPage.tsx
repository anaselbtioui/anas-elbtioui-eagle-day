import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WizardFrame, WizardSection } from '@/app/WizardFrame'
import { Button } from '@/components/ui/button'
import { StickyActions } from '@/components/ui/sticky-actions'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioChoice, RadioGroup } from '@/components/ui/radio-group'
import { displayAccidentRef } from '@/domain/accident-ref'
import {
  CAR_PARTS,
  deriveNowStep,
  isNowDraftExpired,
  photoSlotsForParts,
  type CarPart,
  type InjuryAnswer,
  type NowWizardStep,
  type OtherDriverAnswer,
  type PhotoSlotId,
} from '@/domain/evidence'
import type { Contact } from '@/domain/types.ts'
import { pickFromGallery, takePhoto } from '@/platform/camera'
import { savePhotoBlob } from '@/platform/photos'
import { api } from '@/services/api.ts'
import {
  downloadAideMemoirePdf,
  downloadConstatDraftPdf,
} from '@/services/accident-docs.ts'
import { walletClaimReady } from '@/services/wallet.ts'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { CarDamageMap } from './CarDamageMap'

type Step = NowWizardStep

export function NowPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)
  const { pack, start, dispatch, clearActive, starting, error, sweepExpired } =
    useEvidenceStore()
  const [step, setStep] = useState<Step>('injury')
  const [authorityContacts, setAuthorityContacts] = useState<Contact[]>([])
  const [assistContacts, setAssistContacts] = useState<Contact[]>([])
  const slots = photoSlotsForParts(pack?.damagedParts ?? [])

  useEffect(() => {
    void api.listContacts(profile.assistanceOnContract).then((list) => {
      setAuthorityContacts(list.filter((c) => c.role === 'authorities'))
      setAssistContacts(list.filter((c) => c.role === 'assistance'))
    })
  }, [profile.assistanceOnContract])

  useEffect(() => {
    sweepExpired()
  }, [sweepExpired])

  useEffect(() => {
    if (!pack) {
      setStep('injury')
      return
    }
    if (pack.status === 'expired' || isNowDraftExpired(pack)) {
      sweepExpired()
      setStep('expired')
      return
    }
    setStep(deriveNowStep(pack))
    // Resume / open: derive once per pack id — not on every field edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional pack-id gate
  }, [pack?.id])

  useEffect(() => {
    if (!pack) return
    if (pack.status === 'expired' || isNowDraftExpired(pack)) {
      sweepExpired()
      setStep('expired')
    }
  }, [pack?.status, pack?.createdAt, pack, sweepExpired])

  if (pack && (step === 'expired' || pack.status === 'expired')) {
    return (
      <WizardFrame title={t('now.title')}>
        <WizardSection title={t('now.expiredTitle')} hint={t('now.expiredBody')}>
          <Card className="mb-4">
            <CardTitle className="font-mono text-base">
              {displayAccidentRef(pack.ref, pack.id)}
            </CardTitle>
          </Card>
          <StickyActions>
            <Button
              className="w-full"
              disabled={starting}
              onClick={() => {
                clearActive()
                void start().then(() => setStep('injury'))
              }}
              data-testid="now-expired-new"
            >
              {starting ? t('now.starting') : t('home.doorNowShort')}
            </Button>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                clearActive()
                navigate('/')
              }}
            >
              {t('now.backHome')}
            </Button>
          </StickyActions>
        </WizardSection>
      </WizardFrame>
    )
  }

  if (!pack) {
    return (
      <WizardFrame title={t('now.title')}>
        <WizardSection title={t('now.title')} hint={t('app.notAClaim')}>
          {error ? (
            <p className="mb-3 rounded-[var(--radius-labas)] bg-alert-soft px-3 py-2 text-sm text-alert">
              {error}
            </p>
          ) : null}
          <StickyActions>
            <Button
              className="w-full"
              disabled={starting}
              onClick={() => {
                void start().then(() => setStep('injury'))
              }}
            >
              {starting ? t('now.starting') : t('home.doorNow')}
            </Button>
          </StickyActions>
        </WizardSection>
      </WizardFrame>
    )
  }

  function onInjury(value: string) {
    const injury = value as InjuryAnswer
    dispatch({ type: 'SET_INJURY', injury })
    if (injury === 'yes' || injury === 'unknown') {
      setStep('stop')
    } else {
      setStep('other')
    }
  }

  function onOther(value: string) {
    const otherDriver = value as OtherDriverAnswer
    dispatch({ type: 'SET_OTHER', otherDriver })
    if (otherDriver === 'refuses' || otherDriver === 'fled' || otherDriver === 'unknown') {
      setStep('stop')
    } else {
      setStep('constat')
    }
  }

  async function capture(slot: PhotoSlotId, fromGallery = false) {
    const dataUrl = fromGallery ? await pickFromGallery() : await takePhoto()
    if (!dataUrl || !pack) return
    await savePhotoBlob(pack.id, slot, dataUrl)
    dispatch({ type: 'SET_PHOTO', slot, dataUrl })
  }

  const alert = step === 'stop'
  const assistPhone = profile.assistanceNumber.trim() || assistContacts[0]?.phone || null
  const claimReady = walletClaimReady(profile)

  const partLabels = (pack?.damagedParts ?? []).map((p) => t(`now.part_${p}`))

  function onDownloadAide() {
    if (!pack) return
    downloadAideMemoirePdf(profile, pack, partLabels)
  }

  function onDownloadConstat() {
    if (!pack) return
    downloadConstatDraftPdf(profile, pack, partLabels)
  }

  const stepFooter =
    step === 'constat' ? (
      <Button className="w-full" onClick={() => setStep('car')}>
        {t('app.continue')}
      </Button>
    ) : step === 'car' ? (
      <Button
        className="w-full"
        onClick={() => setStep('photos')}
        disabled={pack.damagedParts.length === 0}
      >
        {t('app.continue')}
      </Button>
    ) : step === 'photos' ? (
      <Button className="w-full" onClick={() => setStep('drive')}>
        {t('app.continue')}
      </Button>
    ) : null

  return (
    <WizardFrame title={t('now.title')} alert={alert}>
      {stepFooter ? <StickyActions>{stepFooter}</StickyActions> : null}

      {step === 'injury' ? (
        <WizardSection title={t('now.safetyTitle')} hint={t('now.safetyHint')}>
          <RadioGroup onValueChange={onInjury}>
            <RadioChoice value="no" label={t('now.injuryNo')} />
            <RadioChoice value="yes" label={t('now.injuryYes')} />
            <RadioChoice value="unknown" label={t('now.injuryUnknown')} />
          </RadioGroup>
        </WizardSection>
      ) : null}

      {step === 'stop' ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl font-bold text-alert">{t('now.stopTitle')}</h2>
          <p className="text-base text-ink">{t('now.stopBody')}</p>
          <p className="text-sm text-ink-muted">{t('now.pvNote')}</p>
          <div className="space-y-3">
            <Button asChild variant="alert" className="w-full" size="lg">
              <a href="tel:19">{t('now.call19')}</a>
            </Button>
            <Button asChild variant="softAlert" className="w-full">
              <a href="tel:19">{t('now.callPolice')}</a>
            </Button>
            {authorityContacts.length > 0 ? (
              <div className="space-y-2" data-testid="stop-contacts">
                <p className="text-sm font-semibold">{t('assist.contactsTitle')}</p>
                {authorityContacts.map((c) => (
                  <Card key={c.id}>
                    <CardTitle className="text-base">{c.displayName}</CardTitle>
                    <CardDescription>
                      {c.note}
                      {c.phone ? (
                        <>
                          <br />
                          <a href={`tel:${c.phone}`} className="font-semibold text-alert">
                            {c.phone}
                          </a>
                        </>
                      ) : null}
                    </CardDescription>
                  </Card>
                ))}
              </div>
            ) : null}
            <div className="rounded-[var(--radius-labas)] border border-border bg-surface/90 p-4">
              <p className="text-sm text-ink-muted">{t('now.downloadAideMemoireHint')}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={onDownloadAide}
                data-testid="download-aide-memoire"
              >
                {t('now.downloadAideMemoire')}
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                clearActive()
                navigate('/')
              }}
            >
              {t('app.finish')}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'other' ? (
        <WizardSection title={t('now.otherTitle')}>
          <RadioGroup onValueChange={onOther}>
            <RadioChoice value="cooperates" label={t('now.otherCooperates')} />
            <RadioChoice value="alone" label={t('now.otherAlone')} />
            <RadioChoice value="refuses" label={t('now.otherRefuses')} />
            <RadioChoice value="fled" label={t('now.otherFled')} />
            <RadioChoice value="unknown" label={t('now.otherUnknown')} />
          </RadioGroup>
        </WizardSection>
      ) : null}

      {step === 'constat' ? (
        <WizardSection title={t('now.constatTitle')} hint={t('now.constatHint')}>
          <Card className="mb-4 bg-moss-soft border-moss/30">
            <CardTitle className="text-sm">{t('now.attestationCard')}</CardTitle>
            <CardDescription>
              {profile.name}
              <br />
              {profile.plate} · {profile.vehicle}
              <br />
              {profile.insurer} · {profile.policy || '—'}
            </CardDescription>
          </Card>
          <div className="space-y-3">
            <Field
              label={t('now.otherName')}
              value={pack.constat.otherName}
              onChange={(v) => dispatch({ type: 'SET_CONSTAT', constat: { otherName: v } })}
            />
            <Field
              label={t('now.otherPlate')}
              value={pack.constat.otherPlate}
              onChange={(v) => dispatch({ type: 'SET_CONSTAT', constat: { otherPlate: v } })}
            />
            <Field
              label={t('now.otherPhone')}
              value={pack.constat.otherPhone}
              onChange={(v) => dispatch({ type: 'SET_CONSTAT', constat: { otherPhone: v } })}
            />
            <Field
              label={t('now.otherInsurer')}
              value={pack.constat.otherInsurer}
              onChange={(v) => dispatch({ type: 'SET_CONSTAT', constat: { otherInsurer: v } })}
            />
            <div className="space-y-2">
              <Label htmlFor="notes">{t('now.notes')}</Label>
              <textarea
                id="notes"
                className="min-h-28 w-full rounded-[var(--radius-labas)] border-2 border-border bg-surface p-3"
                value={pack.constat.notes}
                onChange={(e) =>
                  dispatch({ type: 'SET_CONSTAT', constat: { notes: e.target.value } })
                }
                placeholder={t('app.noFault')}
              />
            </div>
            <label className="flex items-start gap-3 rounded-[var(--radius-labas)] border-2 border-border p-4">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={pack.constat.attestedDocsChecked}
                onChange={(e) =>
                  dispatch({
                    type: 'SET_CONSTAT',
                    constat: { attestedDocsChecked: e.target.checked },
                  })
                }
              />
              <span>{t('now.docsChecked')}</span>
            </label>
            <div className="rounded-[var(--radius-labas)] border border-border bg-sand-deep/40 p-4">
              <p className="text-sm text-ink-muted">{t('now.downloadConstatDraftHint')}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full"
                onClick={onDownloadConstat}
                data-testid="download-constat-draft"
              >
                {t('now.downloadConstatDraft')}
              </Button>
            </div>
          </div>
        </WizardSection>
      ) : null}

      {step === 'car' ? (
        <WizardSection title={t('now.carTitle')} hint={t('now.carHint')}>
          <CarDamageMap
            selected={pack.damagedParts}
            onToggle={(part) => dispatch({ type: 'TOGGLE_PART', part })}
            labels={Object.fromEntries(
              CAR_PARTS.map((p) => [p, t(`now.part_${p}`)]),
            ) as Record<CarPart, string>}
          />
        </WizardSection>
      ) : null}

      {step === 'photos' ? (
        <WizardSection title={t('now.photosTitle')} hint={t('now.photosHint')}>
          <ul className="space-y-3">
            {slots.map((slot) => {
              const label =
                slot.startsWith('corner') || slot === 'scene'
                  ? t(`now.slot_${slot}`)
                  : t(`now.part_${slot}`)
              const photo = pack.photos[slot]
              return (
                <li
                  key={slot}
                  className="rounded-[var(--radius-labas)] border border-border bg-surface p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">{label}</span>
                    {photo ? (
                      <span className="text-sm font-semibold text-moss">OK</span>
                    ) : (
                      <span className="text-sm text-ink-muted">—</span>
                    )}
                  </div>
                  {photo ? (
                    <img
                      src={photo}
                      alt={label}
                      className="mb-3 h-36 w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      size="sm"
                      onClick={() => void capture(slot)}
                    >
                      {photo ? t('now.retake') : t('now.takePhoto')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      size="sm"
                      onClick={() => void capture(slot, true)}
                    >
                      {t('now.gallery')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </WizardSection>
      ) : null}

      {step === 'drive' ? (
        <WizardSection title={t('now.driveTitle')}>
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                dispatch({ type: 'SET_DRIVEABLE', driveable: true })
                dispatch({ type: 'SAVE' })
                setStep('saved')
              }}
            >
              {t('now.driveYes')}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                dispatch({ type: 'SET_DRIVEABLE', driveable: false })
                dispatch({ type: 'SHOW_ASSISTANCE' })
                setStep('assist')
              }}
            >
              {t('now.driveNo')}
            </Button>
          </div>
        </WizardSection>
      ) : null}

      {step === 'assist' ? (
        <WizardSection title={t('now.assistTitle')} hint={t('now.assistHint')}>
          <Card className="mb-4">
            <CardTitle>{assistPhone || '—'}</CardTitle>
            <CardDescription>
              {assistContacts[0]?.displayName ?? profile.insurer} · {t('now.assistHint')}
            </CardDescription>
          </Card>
          {assistPhone ? (
            <Button asChild className="mb-3 w-full" variant="moss">
              <a href={`tel:${assistPhone}`}>{t('now.assistCall')}</a>
            </Button>
          ) : null}
          {assistContacts.length > 0 ? (
            <div className="mb-4 space-y-2" data-testid="now-assist-contacts">
              <p className="text-sm font-semibold">{t('assist.contactsTitle')}</p>
              {assistContacts.map((c) => (
                <div
                  key={c.id}
                  className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm"
                >
                  <span className="font-medium">{c.displayName}</span>
                  {c.phone ? (
                    <>
                      <br />
                      <a href={`tel:${c.phone}`} className="text-moss underline">
                        {c.phone}
                      </a>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <StickyActions>
            <Button
              className="w-full"
              onClick={() => {
                dispatch({ type: 'SAVE' })
                setStep('saved')
              }}
            >
              {t('app.continue')}
            </Button>
          </StickyActions>
        </WizardSection>
      ) : null}

      {step === 'saved' ? (
        <WizardSection title={t('now.packTitle')} hint={t('now.packBody')}>
          <Card className="mb-4 border-moss bg-moss-soft">
            <CardTitle className="text-base">
              {displayAccidentRef(pack.ref, pack.id)}
            </CardTitle>
            <CardDescription>
              {pack.damagedParts.length} zone(s) · {Object.keys(pack.photos).length} photo(s)
            </CardDescription>
          </Card>
          <div className="mb-4 rounded-[var(--radius-labas)] border border-border bg-surface p-4">
            <p className="text-sm text-ink-muted">{t('now.downloadConstatDraftHint')}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full"
              onClick={onDownloadConstat}
              data-testid="download-constat-draft-saved"
            >
              {t('now.downloadConstatDraft')}
            </Button>
          </div>
          <StickyActions>
            {claimReady ? (
              <Button asChild className="w-full" variant="moss">
                <Link to="/later">{t('now.declareLater')}</Link>
              </Button>
            ) : (
              <Button asChild className="w-full" variant="moss">
                <Link to="/">{t('later.completeProfile')}</Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="w-full">
              <Link to="/">{t('now.backHome')}</Link>
            </Button>
          </StickyActions>
        </WizardSection>
      ) : null}
    </WizardFrame>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
