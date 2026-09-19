import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import type { EvidencePack, EvidencePackStatus } from '@/domain/evidence'
import type { Dossier } from '@/domain/types.ts'
import { api } from '@/services/api.ts'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { cn } from '@/lib/utils'

function statusTone(status: EvidencePackStatus): string {
  switch (status) {
    case 'saved':
      return 'bg-moss-soft text-moss'
    case 'stopped':
      return 'bg-alert-soft text-alert'
    default:
      return 'bg-sand-deep text-ink-muted'
  }
}

function nextStepForPack(status: EvidencePackStatus): { to: string; labelKey: string } | null {
  if (status === 'draft') return { to: '/now', labelKey: 'motorist.pastContinueNow' }
  if (status === 'saved') return { to: '/later', labelKey: 'motorist.pastOpenLater' }
  return null
}

export function PastAccidentsPage() {
  const { t } = useTranslation()
  const { packId } = useParams()
  const profile = useProfileStore((s) => s.profile)
  const history = useEvidenceStore((s) => s.history)
  const active = useEvidenceStore((s) => s.pack)
  const hydrateFromDomain = useEvidenceStore((s) => s.hydrateFromDomain)
  const [dossierById, setDossierById] = useState<Record<string, Dossier | null>>({})

  useEffect(() => {
    if (!profile.onboarded) return
    void api.listPacks(profile.motoristId).then(hydrateFromDomain).catch(() => undefined)
  }, [profile.onboarded, profile.motoristId, hydrateFromDomain])

  const packs = useMemo(() => {
    const byId = new Map<string, EvidencePack>()
    for (const h of history) byId.set(h.id, h)
    if (active) byId.set(active.id, active)
    return [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [history, active])

  const savedIds = useMemo(
    () => packs.filter((p) => p.status === 'saved').map((p) => p.id),
    [packs],
  )

  useEffect(() => {
    let cancelled = false
    for (const id of savedIds) {
      void api
        .getFile(id)
        .then((file) => {
          if (!cancelled) {
            setDossierById((prev) => ({ ...prev, [id]: file.dossier }))
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDossierById((prev) => ({ ...prev, [id]: null }))
          }
        })
    }
    return () => {
      cancelled = true
    }
  }, [savedIds])

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  const selected = packId ? packs.find((p) => p.id === packId) : null

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
          {t('motorist.pastTitle')}
        </h1>
      </header>

      {packs.length === 0 ? (
        <Card className="border-border bg-surface/90">
          <CardTitle className="text-base">{t('motorist.pastEmpty')}</CardTitle>
          <Button asChild className="mt-4" variant="default">
            <Link to="/">{t('motorist.pastGoClaims')}</Link>
          </Button>
        </Card>
      ) : (
        <ul className="space-y-3">
          {packs.map((p) => {
            const step = nextStepForPack(p.status)
            const dossier = dossierById[p.id]
            const highlighted = selected?.id === p.id || (!packId && packs[0]?.id === p.id)
            return (
              <li key={p.id}>
                <Card
                  className={cn(
                    'border-border bg-surface/90 transition-colors',
                    highlighted && 'outline outline-1 outline-ink/20',
                  )}
                  data-testid={`past-pack-${p.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">{p.id}</CardTitle>
                      <CardDescription>
                        {t('motorist.pastUpdated', { date: p.updatedAt.slice(0, 10) })}
                      </CardDescription>
                    </div>
                    <span
                      className={cn(
                        'rounded-[var(--radius-labas)] px-2.5 py-1 text-xs font-semibold',
                        statusTone(p.status),
                      )}
                    >
                      {t(`motorist.packStatus.${p.status}`)}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-ink-muted">
                    {t(`motorist.packStatusHint.${p.status}`)}
                  </p>

                  {dossier ? (
                    <div className="mt-3 rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm">
                      <p className="font-semibold">{t('home.dossierStatus')}</p>
                      <p>{t(`broker.status.${dossier.status}`)}</p>
                      <p className="text-ink-muted">{dossier.nextHumanStep}</p>
                    </div>
                  ) : null}

                  {step ? (
                    <Button asChild className="mt-4 w-full sm:w-auto" variant="moss">
                      <Link to={step.to}>{t(step.labelKey)}</Link>
                    </Button>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
