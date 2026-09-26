import { useEffect, useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShellScroll } from '@/app/AppShell'
import { LifecycleRail } from '@/components/LifecycleRail'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { LoadingLine } from '@/components/ui/loading-line'
import { Card, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { StickyActions } from '@/components/ui/sticky-actions'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { dossierLifecycleStages } from '@/domain/lifecycle.ts'
import { ACAPS_NOTIFY_GUIDANCE } from '@/domain/types.ts'
import type { DocumentRequestPiece, MessageIntent } from '@/domain/desk.ts'
import { fullTimestamp, shortRelative } from '@/lib/relative-time'
import { api } from '@/services/api.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
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
  const { t, i18n } = useTranslation()
  const bundle = useBrokerDeskStore((s) => s.bundles.find((b) => b.dossierId === dossierId))
  const loadOne = useBrokerDeskStore((s) => s.loadOne)
  const requestPiece = useBrokerDeskStore((s) => s.requestPiece)
  const addDraft = useBrokerDeskStore((s) => s.addDraft)
  const setHumanApproved = useBrokerDeskStore((s) => s.setHumanApproved)
  const setDraftBody = useBrokerDeskStore((s) => s.setDraftBody)
  const approveMessage = useBrokerDeskStore((s) => s.approveMessage)
  const toggleTaskDone = useBrokerDeskStore((s) => s.toggleTaskDone)
  const [lookup, setLookup] = useState<'loading' | 'ready'>(bundle ? 'ready' : 'loading')
  const [motoristAvatarUrl, setMotoristAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    if (bundle) {
      setLookup('ready')
      return
    }
    void loadOne(dossierId).finally(() => setLookup('ready'))
  }, [bundle, dossierId, loadOne])

  useEffect(() => {
    const motoristId = bundle?.profile.motorist.id
    const path = bundle?.profile.motorist.avatarPhotoPath
    if (!motoristId || !path) {
      setMotoristAvatarUrl(null)
      return
    }
    let cancelled = false
    void api
      .brokerMotoristAvatarUrl(motoristId)
      .then((res) => {
        if (!cancelled) setMotoristAvatarUrl(res.url)
      })
      .catch(() => {
        if (!cancelled) setMotoristAvatarUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [bundle?.profile.motorist.id, bundle?.profile.motorist.avatarPhotoPath])

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

  useEffect(() => {
    if (activeDraft) setDraftText(activeDraft.body)
  }, [activeDraft?.id, activeDraft?.body])

  if (lookup === 'loading') {
    return <LoadingLine />
  }

  if (!bundle) {
    return <Navigate to="/desk" replace />
  }

  const { profile, pack, dossier, provenance } = bundle
  const closed = Boolean(dossier.closedReason)
  const liveActionsDisabled = closed
  const freshnessIso = provenance.freshness
  const freshnessLabel = shortRelative(freshnessIso, i18n.language)
  const freshnessFull = fullTimestamp(freshnessIso, i18n.language)
  const gapsLine = dossier.missingPieces.length
    ? dossier.missingPieces.map((p) => t(`broker.piece.${p}`)).join(' · ')
    : null
  const gapStageId = dossier.status === 'waiting_motorist' ? 'desk' : 'collect'
  const lifecycleStages = dossierLifecycleStages(dossier.status, dossier.closedReason).map(
    (stage) => {
      if (stage.id !== gapStageId || dossier.missingPieces.length === 0) return stage
      return {
        ...stage,
        actions: dossier.missingPieces.map((p) => ({
          id: p,
          label: t(`broker.piece.${p}`),
          disabled: liveActionsDisabled,
          onClick: () => {
            if (liveActionsDisabled) return
            setPiece(p)
            setRequestOpen(true)
          },
        })),
      }
    },
  )

  const sourcesLine = [
    gapsLine ?? t('broker.noGaps'),
    ACAPS_NOTIFY_GUIDANCE,
  ].join(' · ')

  function submitRequest() {
    if (liveActionsDisabled) return
    void requestPiece(dossierId, piece, note.trim()).then(() => {
      setRequestOpen(false)
      setNote('')
    })
  }

  function openDraft() {
    if (liveActionsDisabled) return
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
    if (liveActionsDisabled) return
    if (!activeDraft || draftText === activeDraft.body) return
    void setDraftBody(dossierId, activeDraft.id, draftText)
  }

  return (
    <ShellScroll>
      <div className="mb-4">
        <h1 className="font-display text-3xl font-bold">{bundle.title}</h1>
        <p className="mt-1 text-ink-muted">
          {profile.motorist.name} · {pack.incident.city}
        </p>
        {closed ? (
          <span
            className="mt-3 inline-block rounded-full bg-alert-soft px-3 py-1 text-xs font-semibold text-alert"
            data-testid="dossier-closed"
          >
            {t(
              dossier.closedReason === 'cancelled'
                ? 'broker.closedCancelled'
                : 'broker.closedArchived',
            )}
          </span>
        ) : null}
        {closed ? (
          <p
            className="mt-3 rounded-[var(--radius-labas)] border border-alert/30 bg-alert-soft px-4 py-3 text-sm text-ink"
            data-testid="dossier-closed-banner"
            role="status"
          >
            {t(
              dossier.closedReason === 'cancelled'
                ? 'broker.closedBannerCancelled'
                : 'broker.closedBannerArchived',
            )}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative">
          <div className="flex gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft outline outline-1 outline-ink/15"
              aria-hidden
            >
              {motoristAvatarUrl ? (
                <img
                  src={motoristAvatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <LabasIcon name="user" className="h-7 w-7" tone="onSand" />
              )}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5 pb-6">
              <p className="font-display text-lg font-semibold leading-tight text-ink">
                {profile.motorist.name}
              </p>
              {profile.motorist.phone ? (
                <p className="font-mono text-sm tabular-nums text-ink-muted">
                  {profile.motorist.phone}
                </p>
              ) : null}
              <p className="text-sm leading-snug text-ink">
                {[profile.vehicle.makeModel, profile.vehicle.plate].filter(Boolean).join(' · ') ||
                  '—'}
              </p>
              <p className="text-sm leading-snug text-ink">
                <span className="font-mono tabular-nums">
                  {profile.policy.number ?? '—'}
                </span>
                {' · '}
                {profile.insurer.displayName}
              </p>
              {profile.policy.assistanceOnContract !== 'unknown' ? (
                <p className="text-sm text-ink-muted">
                  {t(`broker.assistance.${profile.policy.assistanceOnContract}`)}
                </p>
              ) : null}
              {pack.incident.injury === 'yes' || pack.incident.injury === 'unknown' ? (
                <p className="mt-1 rounded-[var(--radius-labas)] bg-alert-soft px-3 py-2 text-sm text-alert">
                  {t('broker.injuryFlag')}
                </p>
              ) : null}
              {pack.incident.vehicleImmobilised ? (
                <p className="mt-1 rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm">
                  {t('broker.immobilisedFlag')}
                </p>
              ) : null}
            </div>
          </div>
          <span
            className="absolute bottom-5 right-5 font-mono text-[0.6875rem] font-medium tabular-nums text-ink-muted/70"
            title={freshnessFull}
          >
            {freshnessLabel}
          </span>
        </Card>

        <Card data-testid="dossier-status">
          <span className="sr-only">{t(`broker.status.${dossier.status}`)}</span>
          <LifecycleRail stages={lifecycleStages} />
        </Card>

        <Card className="lg:col-span-2" data-testid="pieces-section">
          <CardDescription>
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
              {gapsLine ?? t('broker.noGaps')}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{dossier.nextHumanStep}</p>
          </CardDescription>
        </Card>

        <Card>
          <ul className="space-y-2">
            {bundle.tasks.map((task) => (
              <li key={task.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--radius-labas)] px-2 hover:bg-sand-deep">
                  <input
                    type="checkbox"
                    checked={task.done}
                    disabled={liveActionsDisabled}
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
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              className="flex-1"
              variant="secondary"
              disabled={liveActionsDisabled}
              onClick={() => setRequestOpen(true)}
              data-testid="open-request"
            >
              {t('broker.requestCta')}
            </Button>
            <Button
              className="flex-1"
              disabled={liveActionsDisabled}
              onClick={openDraft}
              data-testid="open-draft"
            >
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
          <ul className="space-y-2">
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
                <label className="flex min-h-12 items-start gap-3 rounded-[var(--radius-labas)] border border-border p-3">
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
    </ShellScroll>
  )
}
