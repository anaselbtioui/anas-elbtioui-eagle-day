import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { WizardFrame, WizardSection } from '@/app/WizardFrame'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { StickyActions } from '@/components/ui/sticky-actions'
import { canSubmit } from '@/domain/rules.ts'
import type { DeskEvent } from '@/domain/desk.ts'
import type { Contact, Dossier, EvidencePack as DomainPack } from '@/domain/types.ts'
import { api } from '@/services/api.ts'
import { packLooksStarted } from '@/services/pack-map.ts'
import { walletClaimReady } from '@/services/wallet.ts'
import { useProfileStore } from '@/store/profile.ts'

type Step = 'edit' | 'review'

export function LaterPage() {
  const { t } = useTranslation()
  const profile = useProfileStore((s) => s.profile)
  const motoristId = profile.motoristId
  const brokerName = profile.broker
  const claimReady = walletClaimReady(profile)
  const [pack, setPack] = useState<DomainPack | null>(null)
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [facts, setFacts] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('edit')
  const [confirmSend, setConfirmSend] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [events, setEvents] = useState<DeskEvent[]>([])
  const [brokerContact, setBrokerContact] = useState<Contact | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const packs = (await api.listPacks(motoristId)).filter(packLooksStarted)
        const latest = packs[0] ?? null
        if (!latest) {
          if (!cancelled) {
            setPack(null)
            setLoading(false)
          }
          return
        }
        const file = await api.getFile(latest.incident.id)
        if (cancelled) return
        setPack(file.pack)
        setDossier(file.dossier)
        setSubmittedAt(file.declaration?.submittedAt ?? null)
        setFacts(file.declaration?.narrative ?? '')
        if (file.dossier?.id) {
          try {
            const bundle = await api.getBrokerDossier(file.dossier.id)
            if (!cancelled) {
              setEvents((bundle.events ?? []).filter((e) => e.motoristVisible))
            }
          } catch {
            /* desk may not exist yet */
          }
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'load_failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [motoristId])

  useEffect(() => {
    void api.listContacts('unknown').then((list) => {
      setBrokerContact(list.find((c) => c.role === 'broker') ?? null)
    })
  }, [])

  async function markPiece(kind: 'constat' | 'pv') {
    if (!pack) return
    setBusy(true)
    setError(null)
    try {
      const file = await api.addPieces(pack.incident.id, {
        constat: kind === 'constat' ? 'complete' : undefined,
        pv: kind === 'pv' ? 'obtained' : undefined,
      })
      setPack(file.pack)
      setDossier(file.dossier)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save_failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveFactsDraft() {
    if (!pack) return
    try {
      await api.saveDeclarationDraft(pack.incident.id, {
        narrative: facts,
        channel: 'broker',
      })
      setDraftSaved(true)
    } catch {
      /* silent — user can retry on send */
    }
  }

  async function send() {
    if (!pack) return
    setBusy(true)
    setError(null)
    try {
      await api.saveDeclarationDraft(pack.incident.id, {
        narrative: facts,
        channel: 'broker',
      })
      const bundle = await api.submitDeclaration(pack.incident.id)
      setDossier(bundle.dossier)
      setSubmittedAt(bundle.declaration.submittedAt)
      try {
        const desk = await api.getBrokerDossier(bundle.dossier.id)
        setEvents((desk.events ?? []).filter((e) => e.motoristVisible))
      } catch {
        /* motorist cannot read desk route — events optional */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submit_failed')
    } finally {
      setBusy(false)
    }
  }

  if (!claimReady) {
    return (
      <WizardFrame title={t('later.title')}>
        <WizardSection title={t('later.title')} hint={t('later.profileIncomplete')}>
          <StickyActions>
            <Button asChild className="w-full" variant="moss">
              <Link to="/">{t('later.completeProfile')}</Link>
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to="/">{t('app.back')}</Link>
            </Button>
          </StickyActions>
        </WizardSection>
      </WizardFrame>
    )
  }

  if (loading) {
    return (
      <WizardFrame title={t('later.title')}>
        <p className="text-ink-muted">{t('later.loading')}</p>
      </WizardFrame>
    )
  }

  if (!pack) {
    return (
      <WizardFrame title={t('later.title')}>
        <WizardSection title={t('later.title')} hint={t('later.noPack')}>
          <StickyActions>
            <Button asChild className="w-full">
              <Link to="/now">{t('home.doorNow')}</Link>
            </Button>
          </StickyActions>
        </WizardSection>
      </WizardFrame>
    )
  }

  const ready = canSubmit(pack.evidence) && claimReady && Boolean(profile.brokerId.trim())
  const sent = Boolean(submittedAt)
  const displayBroker = brokerName || brokerContact?.displayName || t('onboarding.broker')

  return (
    <WizardFrame title={t('later.title')}>
      <WizardSection title={t('later.title')} hint={t('later.body')}>
        {error ? (
          <p className="mb-4 rounded-[var(--radius-labas)] bg-alert-soft px-3 py-2 text-sm text-alert">
            {error}
          </p>
        ) : null}

        {sent ? (
          <Card className="mb-4 border-moss bg-moss-soft" data-testid="later-tracking">
            <CardTitle className="text-base">{t('later.tracking')}</CardTitle>
            <CardDescription className="mt-2 space-y-2 text-ink">
              <p>{t('later.submitted', { broker: displayBroker })}</p>
              {dossier ? (
                <>
                  <p>{t(`broker.status.${dossier.status}`)}</p>
                  <p>{dossier.nextHumanStep}</p>
                  {dossier.notifiedWithinGuidanceNote ? (
                    <p className="text-sm text-ink-muted">{dossier.notifiedWithinGuidanceNote}</p>
                  ) : null}
                </>
              ) : null}
            </CardDescription>
            {events.length > 0 ? (
              <ul className="mt-4 space-y-2" data-testid="later-events">
                {events.map((ev) => (
                  <li
                    key={ev.id}
                    className="rounded-[var(--radius-labas)] bg-surface/80 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{ev.label}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{ev.at}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : step === 'review' ? (
          <div className="space-y-4" data-testid="later-review">
            <Card>
              <CardTitle className="text-base">{t('later.review')}</CardTitle>
              <CardDescription className="mt-3 space-y-2 text-ink">
                <div>
                  <span className="font-semibold">{t('later.piecesTitle')}: </span>
                  {t('later.constat')} {t(`broker.constat.${pack.evidence.constat}`)},{' '}
                  {t('later.pv')} {t(`broker.pv.${pack.evidence.pv}`)},{' '}
                  {pack.evidence.photos.length
                    ? t('broker.photosCount', { count: pack.evidence.photos.length })
                    : t('broker.photosNone')}
                  <button
                    type="button"
                    className="ml-2 text-sm font-semibold text-moss underline"
                    onClick={() => setStep('edit')}
                  >
                    {t('later.changePieces')}
                  </button>
                </div>
                <div>
                  <span className="font-semibold">{t('later.facts')}: </span>
                  {facts.trim() || '—'}
                  <button
                    type="button"
                    className="ml-2 text-sm font-semibold text-moss underline"
                    onClick={() => setStep('edit')}
                  >
                    {t('later.changeFacts')}
                  </button>
                </div>
                <div>
                  <span className="font-semibold">{t('onboarding.broker')}: </span>
                  {displayBroker}
                  {brokerContact?.phone ? ` · ${brokerContact.phone}` : ''}
                </div>
              </CardDescription>
            </Card>
            {brokerContact ? (
              <Card>
                <CardTitle className="text-base">{brokerContact.displayName}</CardTitle>
                <CardDescription>
                  {brokerContact.phone ?? '—'}
                  <br />
                  {brokerContact.note}
                </CardDescription>
                {brokerContact.phone ? (
                  <Button asChild className="mt-3 w-full" variant="secondary">
                    <a href={`tel:${brokerContact.phone}`}>{brokerContact.phone}</a>
                  </Button>
                ) : null}
              </Card>
            ) : null}
            <label className="flex items-start gap-3 rounded-[var(--radius-labas)] border-2 border-border p-4">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-moss"
                checked={confirmSend}
                onChange={(e) => setConfirmSend(e.target.checked)}
                data-testid="later-confirm"
              />
              <span className="font-medium">{t('later.confirmSend')}</span>
            </label>
            <StickyActions>
              <Button
                className="w-full"
                disabled={!ready || busy || !confirmSend}
                onClick={() => void send()}
                data-testid="later-submit"
              >
                {busy ? t('later.sending') : t('later.send')}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('edit')}>
                {t('app.back')}
              </Button>
            </StickyActions>
          </div>
        ) : (
          <>
            <Card className="mb-4" data-testid="later-pieces">
              <CardTitle className="text-base">{t('later.piecesTitle')}</CardTitle>
              <CardDescription className="mt-3 space-y-1 text-ink">
                <div>
                  {t('later.constat')}: {t(`broker.constat.${pack.evidence.constat}`)}
                </div>
                <div>
                  {t('later.pv')}: {t(`broker.pv.${pack.evidence.pv}`)}
                </div>
                <div>
                  {t('later.photos')}:{' '}
                  {pack.evidence.photos.length
                    ? t('broker.photosCount', { count: pack.evidence.photos.length })
                    : t('broker.photosNone')}
                </div>
              </CardDescription>
            </Card>

            {!ready ? (
              <Card className="mb-4 border-alert/30 bg-alert-soft">
                <CardTitle className="text-base">{t('later.gap')}</CardTitle>
                <CardDescription className="mt-2">{t('later.blocked')}</CardDescription>
                <div className="mt-3 flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void markPiece('constat')}
                  >
                    {t('later.markConstat')}
                  </Button>
                  <Button variant="secondary" disabled={busy} onClick={() => void markPiece('pv')}>
                    {t('later.markPv')}
                  </Button>
                </div>
              </Card>
            ) : null}

            <div className="mb-4 space-y-2">
              <Label htmlFor="facts">{t('later.facts')}</Label>
              <textarea
                id="facts"
                className="min-h-28 w-full rounded-[var(--radius-labas)] border-2 border-border bg-surface p-3"
                value={facts}
                onChange={(e) => {
                  setFacts(e.target.value)
                  setDraftSaved(false)
                }}
                onBlur={() => void saveFactsDraft()}
                placeholder={t('later.factsPh')}
                disabled={busy}
              />
              {draftSaved ? (
                <p className="text-xs text-moss">{t('later.savedDraft')}</p>
              ) : null}
            </div>
            <StickyActions>
              <Button
                className="w-full"
                disabled={!ready || busy}
                onClick={() => {
                  setConfirmSend(false)
                  setStep('review')
                }}
                data-testid="later-to-review"
              >
                {t('later.send')}
              </Button>
            </StickyActions>
          </>
        )}
      </WizardSection>
    </WizardFrame>
  )
}
