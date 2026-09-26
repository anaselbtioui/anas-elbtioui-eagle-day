import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { FluidHover } from '@/components/ui/fluid-hover'
import { LoadingLine } from '@/components/ui/loading-line'
import { gapAttr } from '@/features/onboarding/gap-styles'
import { StepNav } from '@/features/onboarding/StepNav'
import { cn } from '@/lib/utils'
import { api } from '@/services/api.ts'
import type { RegisteredBroker } from '@/services/http-contract.ts'
import { useProfileStore } from '@/store/profile'

function BrokerPickAvatar({
  brokerId,
  avatarPhotoPath,
}: {
  brokerId: string
  avatarPhotoPath: string | null
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    if (!avatarPhotoPath) {
      setUrl(null)
      setBroken(false)
      return
    }
    let cancelled = false
    setBroken(false)
    void api
      .registeredBrokerAvatarUrl(brokerId)
      .then((res) => {
        if (!cancelled) setUrl(res.url)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [brokerId, avatarPhotoPath])

  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
    )
  }
  return <LabasIcon name="user" className="h-5 w-5" tone="onSand" />
}

export function BrokerPickStep({
  onBack,
  onSkip,
  onSkipAll,
  onContinue,
  gapsOnly = false,
  persistOnPick = true,
}: {
  onBack: () => void
  onSkip: () => void
  onSkipAll?: () => void
  onContinue: () => void
  gapsOnly?: boolean
  /** When false, selection stays in the profile store until Continue. */
  persistOnPick?: boolean
}) {
  const { t } = useTranslation()
  const { profile, setProfile } = useProfileStore()
  const [brokers, setBrokers] = useState<RegisteredBroker[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void api
      .listRegisteredBrokers()
      .then((list) => {
        if (cancelled) return
        setBrokers(list)
        setLoading(false)
        const current = useProfileStore.getState().profile
        if (list.length === 1) {
          const only = list[0]!
          if (current.brokerId !== only.id || current.broker !== only.displayName) {
            useProfileStore.getState().setProfile({
              brokerId: only.id,
              broker: only.displayName,
            })
          }
          // Do not persist here — Continue acks; skip leaves pending for the nudge sheet.
        } else if (
          current.brokerId &&
          !list.some((b) => b.id === current.brokerId)
        ) {
          useProfileStore.getState().setProfile({ brokerId: '', broker: '' })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'load_failed')
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function pick(id: string, displayName: string) {
    setProfile({ brokerId: id, broker: displayName })
    if (persistOnPick) {
      void useProfileStore.getState().persistDraft()
    }
  }

  function continueWithBroker() {
    void (async () => {
      await useProfileStore.getState().persistDraftNow()
      if (useProfileStore.getState().profile.brokerAutoAssignPending) {
        await useProfileStore.getState().ackBrokerAutoAssign()
      }
      onContinue()
    })()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{t('onboarding.brokerPickHint')}</p>
      {loading ? <LoadingLine className="text-sm" /> : null}
      {loadError ? <p className="text-sm text-alert">{t('onboarding.brokerPickError')}</p> : null}
      {!loading && brokers.length === 0 ? (
        <p className="rounded-[var(--radius-labas)] bg-sand-deep px-3 py-3 text-sm text-ink-muted">
          {t('onboarding.brokerPickEmpty')}
        </p>
      ) : null}
      <FluidHover>
        <ul
          className={cn(
            'space-y-2',
            gapAttr(gapsOnly, profile, 'brokerId') &&
              'rounded-[var(--radius-labas)] ring-2 ring-alert/35',
          )}
          data-testid="broker-pick-list"
          data-wallet-gap={gapAttr(gapsOnly, profile, 'brokerId')}
        >
          {brokers.map((b) => {
            const selected = profile.brokerId === b.id
            return (
              <li key={b.id}>
                <button
                  type="button"
                  data-testid={`broker-pick-${b.id}`}
                  data-fluid-item
                  onClick={() => pick(b.id, b.displayName)}
                  className={cn(
                    'relative z-[1] flex w-full items-center gap-3 rounded-[var(--radius-labas)] border px-3 py-3 text-left',
                    selected
                      ? 'border-ink bg-ink-soft outline outline-1 outline-ink/20'
                      : 'border-border bg-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                      selected ? 'border-ink bg-ink' : 'border-border',
                    )}
                    aria-hidden
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-sand" /> : null}
                  </span>
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft outline outline-1 outline-ink/15"
                    aria-hidden
                  >
                    <BrokerPickAvatar
                      brokerId={b.id}
                      avatarPhotoPath={b.avatarPhotoPath}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{b.displayName}</span>
                    <span className="mt-0.5 block truncate text-sm text-ink-muted">{b.email}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </FluidHover>
      <StepNav
        onBack={onBack}
        onSkip={onSkip}
        onSkipAll={onSkipAll}
        onContinue={continueWithBroker}
        continueDisabled={loading || !profile.brokerId.trim()}
        showSkip
      />
    </div>
  )
}
