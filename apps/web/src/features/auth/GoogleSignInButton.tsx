import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: { credential?: string }) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string
      theme?: string
      size?: string
      text?: string
      shape?: string
      width?: number
    },
  ) => void
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } }
  }
}

function googleClientId(): string {
  return String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}

let gisLoad: Promise<GoogleAccountsId> | null = null

function loadGoogleIdentity(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (gisLoad) return gisLoad
  gisLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-labas-gis="1"]')
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google?.accounts?.id) resolve(window.google.accounts.id)
        else reject(new Error('google_failed'))
      })
      existing.addEventListener('error', () => reject(new Error('google_failed')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.dataset.labasGis = '1'
    script.onload = () => {
      if (window.google?.accounts?.id) resolve(window.google.accounts.id)
      else reject(new Error('google_failed'))
    }
    script.onerror = () => reject(new Error('google_failed'))
    document.head.appendChild(script)
  })
  return gisLoad
}

export function GoogleSignInButton({
  onCredential,
  disabled = false,
  className,
}: {
  onCredential: (idToken: string) => void
  disabled?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  const hostRef = useRef<HTMLDivElement>(null)
  const onCredentialRef = useRef(onCredential)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const clientId = googleClientId()

  onCredentialRef.current = onCredential

  useEffect(() => {
    if (!clientId || disabled) return
    let cancelled = false
    void loadGoogleIdentity()
      .then((id) => {
        if (cancelled || !hostRef.current) return
        hostRef.current.innerHTML = ''
        id.initialize({
          client_id: clientId,
          callback: (response) => {
            const token = response.credential?.trim()
            if (token) onCredentialRef.current(token)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        const width = Math.min(hostRef.current.clientWidth || 320, 400)
        id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          width,
        })
        setReady(true)
        setLoadError(false)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [clientId, disabled, i18n.language])

  if (!clientId) return null

  return (
    <div className={cn('space-y-2', className)} data-testid="auth-google">
      <div
        ref={hostRef}
        className={cn(
          'flex min-h-11 w-full justify-center overflow-hidden',
          (disabled || !ready) && 'pointer-events-none opacity-60',
        )}
        aria-busy={!ready}
      />
      {loadError ? (
        <p className="text-sm text-alert" role="alert">
          {t('auth.errorGoogle')}
        </p>
      ) : null}
    </div>
  )
}
