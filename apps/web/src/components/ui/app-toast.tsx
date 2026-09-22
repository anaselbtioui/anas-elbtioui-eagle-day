import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { useToastStore, type ToastTone } from '@/store/toast'
import { cn } from '@/lib/utils'

function toneIcon(tone: ToastTone): 'warning' | 'clipboard' | 'device' {
  if (tone === 'alert') return 'warning'
  if (tone === 'success') return 'clipboard'
  return 'device'
}

/** Bottom-center toast — mount once (AppShell / root). */
export function AppToast() {
  const { t } = useTranslation()
  const message = useToastStore((s) => s.message)
  const tone = useToastStore((s) => s.tone)
  const clear = useToastStore((s) => s.clear)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !message) return null

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[100] w-[min(calc(100%-2rem),24rem)] -translate-x-1/2 pb-[env(safe-area-inset-bottom)]"
      data-testid="app-toast"
    >
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto relative flex items-start gap-3 rounded-[var(--radius-labas)] border px-3 py-3 pr-12 text-sm font-medium shadow-[0_12px_40px_-12px_rgba(16,40,96,0.4)]',
          tone === 'alert' && 'border-alert/30 bg-alert-soft text-alert',
          tone === 'success' && 'border-moss/30 bg-moss-soft text-moss',
          tone === 'default' && 'border-border bg-surface text-ink',
        )}
        data-testid="app-toast-message"
      >
        <LabasIcon
          name={toneIcon(tone)}
          className="mt-0.5 h-5 w-5 shrink-0"
          tone={tone === 'alert' ? 'alert' : 'onSand'}
          aria-hidden
        />
        <p className="min-w-0 flex-1 leading-snug">{message}</p>
        <button
          type="button"
          className={cn(
            'absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full transition-[transform,background-color] duration-150 ease-out active:scale-[0.96]',
            tone === 'alert' && 'text-alert hover:bg-alert/10',
            tone === 'success' && 'text-moss hover:bg-moss/10',
            tone === 'default' && 'text-ink-muted hover:bg-sand-deep',
          )}
          onClick={clear}
          aria-label={t('app.close')}
          data-testid="app-toast-close"
        >
          <LabasIcon name="close" className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  )
}
