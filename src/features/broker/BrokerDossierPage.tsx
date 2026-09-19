import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { StickyActions } from '@/components/ui/sticky-actions'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { ACAPS_NOTIFY_GUIDANCE } from '@/domain/types.ts'
import type { DocumentRequestPiece, MessageIntent } from '@/domain/desk.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
import { useSessionStore } from '@/store/session'
import { cn } from '@/lib/utils'

const REQUEST_PIECES: DocumentRequestPiece[] = [
  'constat_or_pv',
  'pv',
  'photos',
  'policy_number',
  'assistance_verify',
  'other',
]

const INTENTS: MessageIntent[] = ['missing_piece', 'human_callback', 'next_step']

export function BrokerDossierPage() {
  const { dossierId = '' } = useParams()
  const { t } = useTranslation()
  const bundle = useBrokerDeskStore((s) => s.bundles.find((b) => b.dossierId === dossierId))
  const bundles = useBrokerDeskStore((s) => s.bundles)
  const deskUserName = useSessionStore((s) => s.user?.displayName)
  const loadOne = useBrokerDeskStore((s) => s.loadOne)
  const requestPiece = useBrokerDeskStore((s) => s.requestPiece)
  const addDraft = useBrokerDeskStore((s) => s.addDraft)
  const setHumanApproved = useBrokerDeskStore((s) => s.setHumanApproved)
  const setDraftBody = useBrokerDeskStore((s) => s.setDraftBody)
  const setOwner = useBrokerDeskStore((s) => s.setOwner)
  const handoff = useBrokerDeskStore((s) => s.handoff)
  const approveMessage = useBrokerDeskStore((s) => s.approveMessage)
  const toggleTaskDone = useBrokerDeskStore((s) => s.toggleTaskDone)
  const [lookup, setLookup] = useState<'loading' | 'ready'>(bundle ? 'ready' : 'loading')

  useEffect(() => {
    if (bundle) {
      setLookup('ready')
      return
    }
    void loadOne(dossierId).finally(() => setLookup('ready'))
  }, [bundle, dossierId, loadOne])

  const [requestOpen, setRequestOpen] = useState(false)
  const [draftOpen, setDraftOpen] = useState(false)
  const [piece, setPiece] = useState<DocumentRequestPiece>('constat_or_pv')
  const [note, setNote] = useState('')
  const [intent, setIntent] = useState<MessageIntent>('missing_piece')
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')

  const activeDraft = useMemo(
    () => bundle?.drafts.find((d) => d.id === activeDraftId) ?? bundle?.drafts[0],
    [bundle, activeDraftId],
  )

  const ownerOptions = useMemo(() => {
    const names = new Set<string>(['—'])
    if (deskUserName) names.add(deskUserName)
    for (const item of bundles) {
      if (item.provenance.owner) names.add(item.provenance.owner)
    }
    return [...names]
  }, [bundles, deskUserName])

  useEffect(() => {
    if (activeDraft) setDraftText(activeDraft.body)
  }, [activeDraft?.id, activeDraft?.body])

  if (lookup === 'loading') {
    return <p className="text-ink-muted">{t('later.loading')}</p>
  }

  if (!bundle) {
    return <Navigate to="/desk" replace />
  }

  const { profile, pack, dossier, provenance, declaration } = bundle
  const gapsBlocked = dossier.missingPieces.length > 0

  const sourcesLine = [
    dossier.missingPieces.length
      ? dossier.missingPieces.map((p) => t(`broker.piece.${p}`)).join(', ')
      : t('broker.noGaps'),
    ACAPS_NOTIFY_GUIDANCE,
  ].join(' · ')

  function submitRequest() {
    void requestPiece(dossierId, piece, note.trim()).then(() => {
      setRequestOpen(false)
      setNote('')
    })
  }

  function openDraft() {
    void addDraft(
      dossierId,
      intent,
      t(`broker.piece.${piece === 'pv' ? 'constat_or_pv' : piece}`),
    ).then((id) => {
      if (id) setActiveDraftId(id)
      setDraftOpen(true)
    })
  }

  function onDraftBlur() {
    if (!activeDraft || draftText === activeDraft.body) return
    void setDraftBody(dossierId, activeDraft.id, draftText)
  }

  return (
    <>
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold">{bundle.title}</h1>
        <p className="mt-1 text-ink-muted">
          {profile.motorist.name} · {pack.incident.city}
        </p>
        <span
          className={cn(
            'mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold',
            dossier.status === 'blocked_missing_evidence'
              ? 'bg-alert-soft text-alert'
              : dossier.status === 'waiting_motorist'
                ? 'bg-sand-deep text-ink'
                : 'bg-moss-soft text-moss',
          )}
          data-testid="dossier-status"
        >
          {t(`broker.status.${dossier.status}`)}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="owner">{t('broker.ownerLabel')}</Label>
          <select
            id="owner"
            className="min-h-12 rounded-[var(--radius-labas)] border border-border bg-surface px-3"
            value={provenance.owner || '—'}
            onChange={(e) => void setOwner(dossierId, e.target.value)}
            data-testid="owner-select"
          >
            {ownerOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="moss"
          disabled={gapsBlocked}
          onClick={() => void handoff(dossierId)}
          data-testid="handoff-cta"
          title={gapsBlocked ? t('broker.handoffBlocked') : undefined}
        >
          {t('broker.handoffCta')}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>{t('broker.ficheTitle')}</CardTitle>
          <CardDescription className="mt-3 space-y-1 text-ink">
            <div>
              <span className="font-semibold">{t('broker.field.motorist')}: </span>
              {profile.motorist.name} · {profile.motorist.phone ?? '—'}
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.vehicle')}: </span>
              {profile.vehicle.makeModel ?? '—'} · {profile.vehicle.plate ?? '—'}
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.policy')}: </span>
              {profile.policy.number ?? '—'} · {profile.insurer.displayName}
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.broker')}: </span>
              {profile.broker.displayName} ({t('broker.channel')})
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.assistance')}: </span>
              {t(`broker.assistance.${profile.policy.assistanceOnContract}`)}
            </div>
            {pack.incident.injury === 'yes' || pack.incident.injury === 'unknown' ? (
              <p className="mt-2 rounded-[var(--radius-labas)] bg-alert-soft px-3 py-2 text-sm text-alert">
                {t('broker.injuryFlag')}
              </p>
            ) : null}
            {pack.incident.vehicleImmobilised ? (
              <p className="mt-2 rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm">
                {t('broker.immobilisedFlag')}
              </p>
            ) : null}
          </CardDescription>
        </Card>

        <Card>
          <CardTitle>{t('broker.provenanceTitle')}</CardTitle>
          <CardDescription className="mt-3 space-y-1 text-ink">
            <div>
              <span className="font-semibold">{t('broker.field.source')}: </span>
              {provenance.source}
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.freshness')}: </span>
              {provenance.freshness}
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.owner')}: </span>
              {provenance.owner}
            </div>
            <div>
              <span className="font-semibold">{t('broker.field.declaration')}: </span>
              {declaration?.submittedAt
                ? t('broker.declaredAt', { date: declaration.submittedAt })
                : t('broker.notDeclared')}
            </div>
          </CardDescription>
        </Card>

        <Card className="lg:col-span-2" data-testid="pieces-section">
          <CardTitle>{t('broker.piecesTitle')}</CardTitle>
          <CardDescription className="mt-3">
            <ul className="grid gap-2 sm:grid-cols-3">
              <li className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm text-ink">
                <span className="font-semibold">Constat</span>
                <br />
                {t(`broker.constat.${pack.evidence.constat}`)}
              </li>
              <li className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm text-ink">
                <span className="font-semibold">PV</span>
                <br />
                {t(`broker.pv.${pack.evidence.pv}`)}
              </li>
              <li className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm text-ink">
                <span className="font-semibold">{t('broker.photos')}</span>
                <br />
                {pack.evidence.photos.length
                  ? t('broker.photosCount', { count: pack.evidence.photos.length })
                  : t('broker.photosNone')}
              </li>
            </ul>
            <p className="mt-3 text-sm text-ink" data-testid="missing-pieces">
              <span className="font-semibold">{t('broker.gaps')}: </span>
              {dossier.missingPieces.length
                ? dossier.missingPieces.map((p) => t(`broker.piece.${p}`)).join(', ')
                : t('broker.noGaps')}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{dossier.nextHumanStep}</p>
          </CardDescription>
        </Card>

        <Card>
          <CardTitle>{t('broker.tasksTitle')}</CardTitle>
          <ul className="mt-3 space-y-2">
            {bundle.tasks.map((task) => (
              <li key={task.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-labas)] px-2 hover:bg-sand-deep">
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => void toggleTaskDone(dossierId, task.id)}
                    className="h-5 w-5 accent-moss"
                  />
                  <span className={cn('text-sm', task.done && 'text-ink-muted line-through')}>
                    {task.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>{t('broker.actionsTitle')}</CardTitle>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              variant="secondary"
              onClick={() => setRequestOpen(true)}
              data-testid="open-request"
            >
              {t('broker.requestCta')}
            </Button>
            <Button className="flex-1" onClick={openDraft} data-testid="open-draft">
              {t('broker.draftCta')}
            </Button>
          </div>
          {bundle.requests.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm text-ink-muted">
              {bundle.requests.map((r) => (
                <li key={r.id}>
                  {t('broker.requestLogged', {
                    piece: t(`broker.piece.${r.piece}`),
                  })}
                </li>
              ))}
            </ul>
          ) : null}
          {bundle.drafts.some((d) => d.approvedAt) ? (
            <p className="mt-3 text-sm text-moss">{t('broker.draftApprovedLocal')}</p>
          ) : null}
        </Card>

        <Card className="lg:col-span-2" data-testid="timeline">
          <CardTitle>{t('broker.timeline')}</CardTitle>
          <ul className="mt-3 space-y-2">
            {(bundle.events ?? []).length === 0 ? (
              <li className="text-sm text-ink-muted">—</li>
            ) : (
              (bundle.events ?? []).map((ev) => (
                <li
                  key={ev.id}
                  className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm"
                >
                  <span className="font-medium text-ink">{ev.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {ev.actor} · {ev.at}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Sheet open={requestOpen} onOpenChange={setRequestOpen}>
        <SheetContent className="max-w-lg">
          <SheetTitle>{t('broker.requestTitle')}</SheetTitle>
          <SheetDescription className="sr-only">{t('broker.requestTitle')}</SheetDescription>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="piece">{t('broker.requestPiece')}</Label>
              <select
                id="piece"
                className="min-h-12 w-full rounded-[var(--radius-labas)] border border-border bg-surface px-3"
                value={piece}
                onChange={(e) => setPiece(e.target.value as DocumentRequestPiece)}
              >
                {REQUEST_PIECES.map((p) => (
                  <option key={p} value={p}>
                    {t(`broker.piece.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">{t('broker.requestNote')}</Label>
              <textarea
                id="note"
                className="min-h-24 w-full rounded-[var(--radius-labas)] border border-border bg-surface px-3 py-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('broker.requestNotePh')}
              />
            </div>
          </div>
          <StickyActions>
            <Button className="w-full" onClick={submitRequest} data-testid="submit-request">
              {t('broker.requestSubmit')}
            </Button>
          </StickyActions>
        </SheetContent>
      </Sheet>

      <Sheet open={draftOpen} onOpenChange={setDraftOpen}>
        <SheetContent className="max-w-lg">
          <SheetTitle>{t('broker.draftTitle')}</SheetTitle>
          <SheetDescription className="sr-only">{t('broker.draftTitle')}</SheetDescription>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="intent">{t('broker.draftIntent')}</Label>
              <select
                id="intent"
                className="min-h-12 w-full rounded-[var(--radius-labas)] border border-border bg-surface px-3"
                value={intent}
                onChange={(e) => {
                  const next = e.target.value as MessageIntent
                  setIntent(next)
                  void addDraft(
                    dossierId,
                    next,
                    t(`broker.piece.${piece === 'pv' ? 'constat_or_pv' : piece}`),
                  ).then((id) => {
                    if (id) setActiveDraftId(id)
                  })
                }}
              >
                {INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {t(`broker.intent.${i}`)}
                  </option>
                ))}
              </select>
            </div>
            {activeDraft ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="draft-body">{t('broker.draftTitle')}</Label>
                  <textarea
                    id="draft-body"
                    className="min-h-40 w-full rounded-[var(--radius-labas)] border border-border bg-surface px-3 py-2 text-sm"
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onBlur={onDraftBlur}
                    data-testid="draft-body"
                  />
                  <p className="text-xs text-ink-muted" data-testid="draft-sources">
                    {t('broker.draftSources')}: {sourcesLine}
                  </p>
                </div>
                <label className="flex items-start gap-3 rounded-[var(--radius-labas)] border border-border p-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 accent-moss"
                    checked={activeDraft.humanApproved}
                    onChange={(e) =>
                      void setHumanApproved(dossierId, activeDraft.id, e.target.checked)
                    }
                    data-testid="human-approve"
                  />
                  <span className="text-sm font-medium">{t('broker.humanCheck')}</span>
                </label>
              </>
            ) : null}
          </div>
          {activeDraft ? (
            <StickyActions>
              <Button
                className="w-full"
                disabled={!activeDraft.humanApproved}
                onClick={() => {
                  void approveMessage(dossierId, activeDraft.id).then((ok) => {
                    if (ok) setDraftOpen(false)
                  })
                }}
                data-testid="approve-draft"
              >
                {t('broker.approveLocal')}
              </Button>
            </StickyActions>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
