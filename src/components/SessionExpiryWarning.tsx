import { useCallback, useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CountdownFlipClock } from '@/components/CountdownFlipClock'
import { Button } from '@/components/ui/button'
import { getJwtExpiryMs } from '@/lib/jwtExpiry'
import { api } from '@/services/api.ts'
import { useSessionStore } from '@/store/session'

/** Warn when access JWT expires within this window. */
const WARNING_LEAD_MS = 2 * 60 * 1000
const TICK_MS = 1000
const IDLE_TICK_MS = 30_000
/** Alert only after continuous inactivity. */
const INTERACTIVITY_IDLE_DELAY_MS = 45 * 1000
const SNOOZE_MS = 90 * 1000
const ACTIVE_REFRESH_COOLDOWN_MS = 60 * 1000

/**
 * Modal + flip countdown before JWT expiry (wa-pharma / hamssah pattern).
 * « Rester connecté » calls /api/auth/refresh while token still valid.
 */
export function SessionExpiryWarning() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const token = useSessionStore((s) => s.token)
  const user = useSessionStore((s) => s.user)
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const signOut = useSessionStore((s) => s.signOut)

  const [open, setOpen] = useState(false)
  const [remainingMs, setRemainingMs] = useState(0)
  const [pending, setPending] = useState(false)
  const snoozeUntilRef = useRef(0)
  const lastInteractionAtRef = useRef(Date.now())
  const activeRefreshPendingRef = useRef(false)
  const activeRefreshNextAtRef = useRef(0)
  const expiryHandledRef = useRef(false)

  const closeAndSnooze = useCallback(() => {
    setOpen(false)
    snoozeUntilRef.current = Date.now() + SNOOZE_MS
  }, [])

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const session = await api.refresh()
      applyAuth(session.token, session.user)
      window.dispatchEvent(new Event('labas:token-refreshed'))
      return true
    } catch {
      return false
    }
  }, [applyAuth])

  useEffect(() => {
    const onRefreshed = () => {
      setOpen(false)
      snoozeUntilRef.current = 0
      activeRefreshPendingRef.current = false
      activeRefreshNextAtRef.current = 0
      expiryHandledRef.current = false
    }
    window.addEventListener('labas:token-refreshed', onRefreshed)
    return () => window.removeEventListener('labas:token-refreshed', onRefreshed)
  }, [])

  useEffect(() => {
    const markInteraction = () => {
      lastInteractionAtRef.current = Date.now()
    }
    const onVisibility = () => {
      if (!document.hidden) markInteraction()
    }
    const opts: AddEventListenerOptions = { passive: true }
    markInteraction()
    window.addEventListener('pointerdown', markInteraction, opts)
    window.addEventListener('keydown', markInteraction)
    window.addEventListener('wheel', markInteraction, opts)
    window.addEventListener('scroll', markInteraction, opts)
    window.addEventListener('touchstart', markInteraction, opts)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointerdown', markInteraction, opts)
      window.removeEventListener('keydown', markInteraction)
      window.removeEventListener('wheel', markInteraction, opts)
      window.removeEventListener('scroll', markInteraction, opts)
      window.removeEventListener('touchstart', markInteraction, opts)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!token || !user) {
      setOpen(false)
      return
    }

    let timeoutId: number | undefined

    const trySilentRefresh = (now: number) => {
      if (activeRefreshPendingRef.current || now < activeRefreshNextAtRef.current) return
      activeRefreshPendingRef.current = true
      activeRefreshNextAtRef.current = now + ACTIVE_REFRESH_COOLDOWN_MS
      void refreshSession().finally(() => {
        activeRefreshPendingRef.current = false
      })
    }

    const tick = () => {
      const tkn = useSessionStore.getState().token
      if (!tkn) {
        setOpen(false)
        return TICK_MS
      }
      const expMs = getJwtExpiryMs(tkn)
      if (expMs == null) {
        setOpen(false)
        return IDLE_TICK_MS
      }
      const now = Date.now()
      const rem = expMs - now
      const idleForMs = now - lastInteractionAtRef.current
      setRemainingMs(Math.max(0, rem))

      if (rem <= 0) {
        if (idleForMs < INTERACTIVITY_IDLE_DELAY_MS) {
          setOpen(false)
          trySilentRefresh(now)
          return TICK_MS
        }
        setOpen(false)
        if (!expiryHandledRef.current) {
          expiryHandledRef.current = true
          signOut()
          navigate('/auth', { replace: true })
        }
        return TICK_MS
      }

      expiryHandledRef.current = false

      if (rem > WARNING_LEAD_MS) {
        setOpen(false)
        return Math.min(IDLE_TICK_MS, Math.max(TICK_MS, rem - WARNING_LEAD_MS))
      }

      if (idleForMs < INTERACTIVITY_IDLE_DELAY_MS) {
        setOpen(false)
        trySilentRefresh(now)
        return TICK_MS
      }

      if (now < snoozeUntilRef.current) {
        setOpen(false)
        return TICK_MS
      }

      setOpen(true)
      return TICK_MS
    }

    const scheduleNext = () => {
      const delay = tick()
      timeoutId = window.setTimeout(scheduleNext, delay)
    }
    scheduleNext()
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [token, user, navigate, refreshSession, signOut])

  async function onStay() {
    setPending(true)
    try {
      const ok = await refreshSession()
      if (ok) {
        setOpen(false)
        snoozeUntilRef.current = 0
      }
    } finally {
      setPending(false)
    }
  }

  if (!user) return null

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAndSnooze()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-ink/45" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(100%-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-labas)] border border-border bg-surface p-5 shadow-lg outline-none">
          <Dialog.Title className="font-display text-xl font-bold text-ink">
            {t('session.expiringTitle')}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-muted">
            {t('session.expiringBody')}
          </Dialog.Description>
          <div className="mt-4">
            <CountdownFlipClock totalMs={remainingMs} />
          </div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeAndSnooze} disabled={pending}>
              {t('session.dismiss')}
            </Button>
            <Button type="button" onClick={() => void onStay()} disabled={pending}>
              {pending ? t('session.extending') : t('session.stay')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
