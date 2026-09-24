import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout } from '@/app/AuthSplitLayout'
import { MobileShell } from '@/app/MobileShell'
import { BrandLogo } from '@/components/BrandLogo'
import { LogoutButton } from '@/components/LogoutButton'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { useOnboardingWizard } from '@/features/onboarding/useOnboardingWizard'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { useProfileStore } from '@/store/profile'
import { useSessionStore } from '@/store/session'

export { ONBOARDING_STEPS, type OnboardingStepId } from '@/features/onboarding/steps'
export { OnboardingSteps } from '@/features/onboarding/OnboardingSteps'
export { useOnboardingWizard } from '@/features/onboarding/useOnboardingWizard'

/** Wizard body without Sheet chrome — embed in docked drawer / edit sheet. */
export function OnboardingWizardBody({
  onClose,
  onFinished,
  showStepTitle = true,
  showProgress = true,
  gapsOnly = false,
}: {
  onClose: () => void
  onFinished: () => void
  showStepTitle?: boolean
  /** Inline bar under title. Wallet drawer uses header-edge bar instead. */
  showProgress?: boolean
  /** Jump to incomplete portefeuille steps only. */
  gapsOnly?: boolean
}) {
  const { t } = useTranslation()
  const { stepId, stepTitle, progress, form } = useOnboardingWizard({
    onClose,
    onFinished,
    gapsOnly,
  })
  return (
    <div
      className={cn(showStepTitle ? 'space-y-5' : 'space-y-4')}
      data-testid="onboarding-wizard-body"
    >
      {showProgress ? progress : null}
      {showStepTitle ? (
        <h2 className="font-display text-xl font-bold text-ink">{stepTitle}</h2>
      ) : null}
      {showStepTitle && stepId !== 'welcome' ? (
        <p className="text-sm text-ink-muted">{t('onboarding.subtitle')}</p>
      ) : null}
      {form}
    </div>
  )
}

/** In-session edit: bottom drawer wizard only — never AuthSplit screenshot. */
export function OnboardingEditSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        hideClose={false}
        className="max-w-xl"
        data-testid="onboarding-edit-drawer"
      >
        {open ? (
          <OnboardingWizardBody onClose={close} onFinished={close} showStepTitle gapsOnly />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/** First-time / login context only — AuthSplit screenshot on desktop. */
export function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)
  const signOut = useSessionStore((s) => s.signOut)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 48em)')

  function leaveLogin() {
    if (!confirm(`${t('auth.logoutConfirmTitle')}\n\n${t('auth.logoutConfirmBody')}`)) return
    signOut()
    navigate('/', { replace: true })
  }

  const wizard = useOnboardingWizard({
    onClose: leaveLogin,
    onFinished: () => {
      setDrawerOpen(false)
      navigate('/')
    },
  })

  // Already onboarded → stay in admin shell, open edit drawer via settings.
  if (profile.onboarded) {
    return <Navigate to="/" replace />
  }

  const { stepId, stepTitle, goTo, progress, form } = wizard

  if (isDesktop) {
    return (
      <AuthSplitLayout
        brandTitle={t('onboarding.title')}
        brandBody={t('onboarding.subtitle')}
      >
        <AuthFormCard
          title={stepTitle}
          lead={stepId === 'welcome' ? undefined : t('onboarding.subtitle')}
          progress={progress}
        >
          {form}
        </AuthFormCard>
      </AuthSplitLayout>
    )
  }

  return (
    <MobileShell hideHeader>
      <div className="flex min-h-[calc(100dvh-2.5rem)] flex-col items-center justify-center gap-7 px-4 pb-10 pt-6">
        <BrandLogo size="xl" className="mb-1 drop-shadow-none" />
        <p className="font-display max-w-[18rem] text-center text-[1.35rem] font-semibold leading-snug text-ink">
          {t('onboarding.subtitle')}
        </p>
        <Button
          className="w-full max-w-xs"
          size="lg"
          onClick={() => {
            goTo(profile.onboardingStep || 0)
            setDrawerOpen(true)
          }}
        >
          {t('onboarding.openDrawer')}
        </Button>
        {profile.onboardingStep > 0 ? (
          <p className="text-sm text-ink-muted">{t('onboarding.resumeHint')}</p>
        ) : null}
        <LogoutButton />
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent hideClose={false}>
          <div className="mb-5 space-y-4">
            {progress}
            <SheetTitle>{stepTitle}</SheetTitle>
            {stepId === 'welcome' ? null : (
              <SheetDescription>{t('onboarding.subtitle')}</SheetDescription>
            )}
          </div>
          {form}
        </SheetContent>
      </Sheet>
    </MobileShell>
  )
}
