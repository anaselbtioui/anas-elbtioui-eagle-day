import { useTranslation } from 'react-i18next'
import { TraceSpinner } from '@/components/ui/trace-spinner'
import { cn } from '@/lib/utils'

type LoadingLineProps = {
  className?: string
  label?: string
  size?: number
}

/** Spinner + muted label for page / list waits. */
export function LoadingLine({ className, label, size = 18 }: LoadingLineProps) {
  const { t } = useTranslation()
  const text = label ?? t('later.loading')
  return (
    <p
      className={cn('inline-flex items-center gap-2.5 text-sm text-ink-muted', className)}
      role="status"
      aria-live="polite"
    >
      <TraceSpinner size={size} decorative label={text} />
      <span>{text}</span>
    </p>
  )
}
