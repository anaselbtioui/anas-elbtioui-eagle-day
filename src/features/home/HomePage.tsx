import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { useEvidenceStore } from '@/store/evidencePack'
import { useProfileStore } from '@/store/profile'
import { api } from '@/services/api.ts'
import type { Dossier } from '@/domain/types.ts'
import { cn } from '@/lib/utils'

export function HomePage() {
  const { t } = useTranslation()
  const profile = useProfileStore((s) => s.profile)
  const { history, hydrateFromDomain } = useEvidenceStore()
  const [dossierStatus, setDossierStatus] = useState<Dossier | null>(null)

  useEffect(() => {
    if (!profile.onboarded) return
    void api.listPacks(profile.motoristId).then(hydrateFromDomain).catch(() => undefined)
  }, [profile.onboarded, profile.motoristId, hydrateFromDomain])

  const lastSaved = history.find((h) => h.status === 'saved')

  useEffect(() => {
    if (!lastSaved) {
      setDossierStatus(null)
      return
    }
    let cancelled = false
    void api
      .getFile(lastSaved.id)
      .then((file) => {
        if (!cancelled) setDossierStatus(file.dossier)
      })
      .catch(() => {
        if (!cancelled) setDossierStatus(null)
      })
    return () => {
      cancelled = true
    }
  }, [lastSaved?.id])

  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }

  const firstName = profile.name ? profile.name.split(' ')[0] : ''

  return (
    <div className="home-layout">
      <section className="home-hero" aria-label="Med Assurance">
        <h1 className="font-display mt-1 text-3xl font-bold text-ink md:text-4xl">
          {t('home.hello', { name: firstName ? `, ${firstName}` : '' })}
        </h1>
        <p className="mt-3 max-w-sm text-base text-ink-muted md:text-lg">{t('app.tagline')}</p>
      </section>

      <section className="home-actions">
        {lastSaved ? (
          <Card className="mb-5 border-moss bg-surface">
            <CardTitle className="text-base">{t('home.packSaved')}</CardTitle>
            <CardDescription>{lastSaved.id}</CardDescription>
            {dossierStatus ? (
              <div
                className="mt-3 rounded-[var(--radius-labas)] bg-sand-deep px-3 py-2 text-sm"
                data-testid="home-dossier-status"
              >
                <p className="font-semibold">{t('home.dossierStatus')}</p>
                <p>{t(`broker.status.${dossierStatus.status}`)}</p>
                <p className="text-ink-muted">{dossierStatus.nextHumanStep}</p>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button asChild className="w-full sm:flex-1" variant="moss">
                <Link to="/later">{t('home.openLater')}</Link>
              </Button>
              <Button asChild className="w-full sm:flex-1" variant="outline">
                <Link to={`/past/${lastSaved.id}`}>{t('motorist.pastView')}</Link>
              </Button>
            </div>
          </Card>
        ) : null}

        <div className="home-doors">
          <Door
            to="/now"
            icon={<LabasIcon name="warning" className="h-7 w-7" tone="onInk" aria-hidden />}
            title={t('home.doorNow')}
            hint={t('home.doorNowHint')}
            primary
            className="home-door-primary"
          />
          <Door
            to="/later"
            icon={<LabasIcon name="clipboard" className="h-7 w-7" tone="onSand" aria-hidden />}
            title={t('home.doorLater')}
            hint={t('home.doorLaterHint')}
          />
          <Door
            to="/assist"
            icon={<LabasIcon name="wrench" className="h-7 w-7" tone="onSand" aria-hidden />}
            title={t('home.doorAssist')}
            hint={t('home.doorAssistHint')}
          />
        </div>

        <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
          <LabasIcon name="car" className="h-5 w-5" aria-hidden />
          {t('app.notAClaim')}
        </p>
      </section>
    </div>
  )
}

function Door({
  to,
  icon,
  title,
  hint,
  primary,
  className,
}: {
  to: string
  icon: ReactNode
  title: string
  hint: string
  primary?: boolean
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        primary
          ? 'flex min-h-20 items-start gap-4 rounded-[var(--radius-labas)] bg-ink p-5 text-sand transition-transform active:scale-[0.96]'
          : 'flex min-h-20 items-start gap-4 rounded-[var(--radius-labas)] border-2 border-border bg-surface/90 p-5 text-ink surface-card transition-transform active:scale-[0.96]',
        className,
      )}
    >
      <span className={primary ? 'text-sand' : 'text-ink'}>{icon}</span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span
          className={
            primary ? 'mt-1 block text-sm text-sand/80' : 'mt-1 block text-sm text-ink-muted'
          }
        >
          {hint}
        </span>
      </span>
    </Link>
  )
}
