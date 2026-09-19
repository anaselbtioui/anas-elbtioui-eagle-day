import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShellScroll } from '@/app/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { mappingBadge, type ImportFieldKey, type ImportOutcome, type ImportSource } from '@/domain/browser-import.ts'
import { api } from '@/services/api.ts'
import { setAuthToken } from '@/services/auth-token.ts'
import { subscribeImportEvents } from '@/services/import-events.ts'
import type { ImportSessionPublic } from '@/services/http-contract.ts'
import { useBrokerDeskStore } from '@/store/brokerDesk'
import { useSessionStore } from '@/store/session'
import { cn } from '@/lib/utils'

const SOURCES: ImportSource[] = ['TRT', 'OuiAssur']
const FIXTURE_OUTCOMES: ImportOutcome[] = ['new', 'duplicate', 'conflict', 'interrupted']

export function BrokerImportPage() {
  const { t } = useTranslation()
  const loadQueue = useBrokerDeskStore((s) => s.loadQueue)
  const sessionToken = useSessionStore((s) => s.token)
  const [mode, setMode] = useState<'live' | 'fixture'>('fixture')
  const [source, setSource] = useState<ImportSource>('TRT')
  const [fixtureOutcome, setFixtureOutcome] = useState<ImportOutcome>('new')
  const [consent, setConsent] = useState(false)
  const [session, setSession] = useState<ImportSessionPublic | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, 'current' | 'incoming'>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (sessionToken) setAuthToken(sessionToken)
  }, [sessionToken])

  useEffect(() => {
    if (sessionToken) setAuthToken(sessionToken)
    void api.getImportMode().then((r) => setMode(r.mode)).catch(() => setMode('fixture'))
  }, [sessionToken])

  useEffect(() => {
    if (!session?.id) return
    if (
      session.status === 'await_confirm' ||
      session.status === 'merged' ||
      session.status === 'interrupted' ||
      session.status === 'cancelled'
    ) {
      return
    }
    return subscribeImportEvents(session.id, (next) => {
      setSession(next)
    })
  }, [session?.id, session?.status])

  const conflictFields = useMemo(
    () => session?.mappingRows.filter((r) => r.status === 'Conflit') ?? [],
    [session?.mappingRows],
  )

  const canConfirm = useMemo(() => {
    if (!session || session.status !== 'await_confirm') return false
    const outcome = session.classification?.outcome
    if (outcome === 'new') return true
    if (outcome === 'conflict') {
      return conflictFields.every((f) => resolutions[f.field])
    }
    return false
  }, [session, conflictFields, resolutions])

  async function start() {
    setError(null)
    setResolutions({})
    setBusy(true)
    try {
      const token = useSessionStore.getState().token
      if (token) setAuthToken(token)
      const started = await api.startImportSession({
        source,
        consent: true,
        fixtureOutcome: mode === 'fixture' ? fixtureOutcome : undefined,
      })
      let current = await api.getImportSession(started.sessionId)
      setSession(current)
      // Poll until terminal if SSE slow
      const terminal = new Set(['await_confirm', 'merged', 'interrupted', 'cancelled'])
      for (let i = 0; i < 90 && !terminal.has(current.status); i++) {
        await new Promise((r) => setTimeout(r, 400))
        current = await api.getImportSession(started.sessionId)
        setSession(current)
        if (current.status === 'human_gate') break
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'start_failed')
    } finally {
      setBusy(false)
    }
  }

  async function resume(action: 'continue' | 'cancel') {
    if (!session) return
    setBusy(true)
    try {
      let current = await api.resumeImportSession(session.id, action)
      setSession(current)
      const terminal = new Set(['await_confirm', 'merged', 'interrupted', 'cancelled'])
      for (let i = 0; i < 90 && !terminal.has(current.status); i++) {
        await new Promise((r) => setTimeout(r, 400))
        current = await api.getImportSession(session.id)
        setSession(current)
        if (current.status === 'human_gate') break
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'resume_failed')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      const payload = Object.entries(resolutions).map(([field, choice]) => ({
        field: field as ImportFieldKey,
        choice,
      }))
      const result = await api.confirmImportSession(session.id, payload)
      setSession(await api.getImportSession(session.id))
      await loadQueue()
      useBrokerDeskStore.setState({
        toast: t('broker.importDone', {
          source,
          outcome: t(`broker.importOutcome.${result.created ? 'new' : 'conflict'}`),
        }),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'confirm_failed')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!session) {
      setSession(null)
      return
    }
    setBusy(true)
    try {
      setSession(await api.cancelImportSession(session.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'cancel_failed')
    } finally {
      setBusy(false)
    }
  }

  const badge =
    session?.classification?.outcome != null
      ? mappingBadge(session.classification.outcome)
      : null

  return (
    <ShellScroll>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold">{t('broker.importTitle')}</h1>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              mode === 'live' ? 'bg-moss/15 text-moss' : 'bg-sand-deep text-ink-muted',
            )}
            data-testid="import-mode-badge"
          >
            {mode === 'live' ? t('broker.importModeLive') : t('broker.importModeFixture')}
          </span>
        </div>
      </div>

      {mode === 'fixture' ? (
        <p className="mb-4 text-sm text-ink-muted">{t('broker.importFixtureBanner')}</p>
      ) : (
        <p className="mb-4 text-sm text-ink-muted">{t('broker.importLiveBanner')}</p>
      )}

      <Card className="mb-4 max-w-xl">
        <CardTitle className="text-base">{t('broker.importPickSource')}</CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSource(s)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold',
                source === s ? 'bg-ink text-sand' : 'bg-sand-deep text-ink-muted',
              )}
              data-testid={`import-source-${s}`}
            >
              {s === 'TRT' ? t('broker.importSourceTrt') : t('broker.importSourceOui')}
            </button>
          ))}
        </div>
      </Card>

      {mode === 'fixture' ? (
        <Card className="mb-4 max-w-xl">
          <CardTitle className="text-base">{t('broker.importPickOutcome')}</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {FIXTURE_OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setFixtureOutcome(o)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-xs font-semibold',
                  fixtureOutcome === o ? 'bg-ink text-sand' : 'bg-sand-deep text-ink-muted',
                )}
                data-testid={`import-outcome-${o}`}
              >
                {t(`broker.importOutcome.${o}`)}
              </button>
            ))}
          </div>
          <CardDescription className="mt-3">
            {t(`broker.importOutcomeHint.${fixtureOutcome}`)}
          </CardDescription>
        </Card>
      ) : null}

      <Card className="mb-4 max-w-xl">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            data-testid="import-consent"
          />
          <span>{t('broker.importConsent', { source })}</span>
        </label>
      </Card>

      <div className="mb-4 flex flex-wrap gap-3">
        <Button
          onClick={() => void start()}
          disabled={!consent || busy}
          data-testid="import-run"
        >
          {t('broker.importRun')}
        </Button>
        <Button variant="ghost" onClick={() => void cancel()} disabled={busy}>
          {t('broker.importCancel')}
        </Button>
      </div>

      {error ? (
        <p className="mb-3 text-sm text-alert" data-testid="import-error">
          {error}
        </p>
      ) : null}

      {session ? (
        <Card className="mb-4 max-w-2xl" data-testid="import-journal">
          <CardTitle className="text-base">{t('broker.importJournal')}</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {session.steps.map((step, i) => (
              <li key={`${step.at}-${i}`} className="text-ink-muted">
                <span className="font-medium text-ink">{step.kind}</span> — {step.message}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {session?.status === 'human_gate' && session.humanGate ? (
        <Card className="mb-4 max-w-xl border-moss/40" data-testid="import-human-gate">
          <CardTitle className="text-base">{t('broker.importHumanGate')}</CardTitle>
          <CardDescription className="mt-2">{session.humanGate.reason}</CardDescription>
          <p className="mt-2 text-sm text-ink-muted">{t('broker.importHumanGateHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => void resume('continue')} disabled={busy}>
              {t('broker.importContinue')}
            </Button>
            <Button variant="ghost" onClick={() => void resume('cancel')} disabled={busy}>
              {t('broker.importCancel')}
            </Button>
          </div>
        </Card>
      ) : null}

      {session &&
      (session.status === 'await_confirm' || session.status === 'merged') &&
      session.mappingRows.length > 0 ? (
        <Card className="mb-4 max-w-2xl" data-testid="import-mapping">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{t('broker.importMapping')}</CardTitle>
            {badge ? (
              <span className="rounded-full bg-sand-deep px-3 py-1 text-xs font-semibold">
                {badge}
              </span>
            ) : null}
          </div>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th className="py-2 pr-3 font-medium">{t('broker.importColField')}</th>
                <th className="py-2 pr-3 font-medium">{t('broker.importColCurrent')}</th>
                <th className="py-2 font-medium">{t('broker.importColIncoming')}</th>
              </tr>
            </thead>
            <tbody>
              {session.mappingRows.map((row) => (
                <tr
                  key={row.field}
                  className={cn(
                    'border-b border-border/60',
                    row.status === 'Conflit' && 'bg-alert-soft',
                  )}
                >
                  <td className="py-2 pr-3">
                    {row.label}
                    <small className="ml-2 text-ink-muted">{row.status}</small>
                    {row.status === 'Conflit' && session.status === 'await_confirm' ? (
                      <div className="mt-1 flex gap-2 text-xs">
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={`res-${row.field}`}
                            checked={resolutions[row.field] === 'current'}
                            onChange={() =>
                              setResolutions((r) => ({ ...r, [row.field]: 'current' }))
                            }
                          />
                          {t('broker.importKeepCurrent')}
                        </label>
                        <label className="flex items-center gap-1">
                          <input
                            type="radio"
                            name={`res-${row.field}`}
                            checked={resolutions[row.field] === 'incoming'}
                            onChange={() =>
                              setResolutions((r) => ({ ...r, [row.field]: 'incoming' }))
                            }
                          />
                          {t('broker.importTakeIncoming')}
                        </label>
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.current}</td>
                  <td className="py-2 font-mono text-xs">{row.incoming}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {session.classification?.outcome === 'duplicate' ? (
            <p className="mt-3 text-sm text-ink-muted" data-testid="import-duplicate">
              {session.classification.reason ?? t('broker.importDuplicateBlock')}
              {session.classification.matchDossierId ? (
                <>
                  {' '}
                  <Link
                    className="underline"
                    to={`/desk/${session.classification.matchDossierId}`}
                  >
                    {session.classification.matchDossierId}
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          {session.status === 'await_confirm' ? (
            <div className="mt-4">
              <Button
                onClick={() => void confirm()}
                disabled={!canConfirm || busy}
                data-testid="import-confirm"
              >
                {t('broker.importConfirm')}
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      {session?.status === 'interrupted' || session?.status === 'cancelled' ? (
        <p className="text-sm text-ink-muted" data-testid="import-interrupted">
          {session.classification?.reason ?? t('broker.importInterrupted')}
        </p>
      ) : null}

      {session?.status === 'merged' && session.mergedDossierId ? (
        <p className="text-sm text-moss" data-testid="import-confirmed">
          {t('broker.importMerged')}{' '}
          <Link className="underline" to={`/desk/${session.mergedDossierId}`}>
            {session.mergedDossierId}
          </Link>
        </p>
      ) : null}
    </ShellScroll>
  )
}
