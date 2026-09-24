import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { StickyActions } from '@/components/ui/sticky-actions'

export function StepNav({
  onBack,
  onSkip,
  onSkipAll,
  onContinue,
  continueLabel,
  continueDisabled,
  showSkip = true,
}: {
  onBack: () => void
  onSkip?: () => void
  onSkipAll?: () => void
  onContinue: () => void
  continueLabel?: string
  continueDisabled?: boolean
  showSkip?: boolean
}) {
  const { t } = useTranslation()
  const showSkipLinks = showSkip && (onSkip || onSkipAll)
  return (
    <StickyActions>
      <div className="flex w-full basis-full flex-col gap-3">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
          <Button
            variant="ghost"
            className="w-full sm:w-auto sm:min-w-[7.5rem] sm:flex-none"
            type="button"
            onClick={onBack}
          >
            {t('app.back')}
          </Button>
          <Button
            className="min-w-0 w-full flex-1 whitespace-normal text-center leading-snug"
            type="button"
            onClick={onContinue}
            disabled={continueDisabled}
          >
            {continueLabel ?? t('app.continue')}
          </Button>
        </div>
        {showSkipLinks ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            {onSkip ? (
              <button
                type="button"
                className="min-h-10 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
                onClick={onSkip}
                data-testid="onboarding-skip-step"
              >
                {t('app.skipStep')}
              </button>
            ) : (
              <span aria-hidden className="min-h-10" />
            )}
            {onSkipAll ? (
              <button
                type="button"
                className="min-h-10 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
                onClick={onSkipAll}
                data-testid="onboarding-skip-all"
              >
                {t('app.skipAll')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </StickyActions>
  )
}
