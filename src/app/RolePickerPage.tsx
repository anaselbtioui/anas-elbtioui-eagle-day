import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout } from '@/app/AuthSplitLayout'
import { BrandMark } from '@/components/BrandLogo'
import { LabasIcon } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { useSessionStore, type AppRole } from '@/store/session'

export function RolePickerPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setRole = useSessionStore((s) => s.setRole)

  function pick(role: AppRole) {
    setRole(role)
    navigate('/auth')
  }

  return (
    <AuthSplitLayout
      brandTitle={t('role.title')}
      brandBody={t('role.body')}
      mobileHero={
        <div className="mb-2 space-y-2 text-center">
          <BrandMark size="lg" className="mx-auto" />
          <p className="font-display text-2xl font-bold text-ink">{t('role.title')}</p>
          <p className="text-sm text-ink-muted">{t('role.body')}</p>
        </div>
      }
    >
      <AuthFormCard title={t('role.choose')} lead={t('role.lead')}>
        <div className="space-y-3">
          <Button
            className="h-auto w-full justify-start gap-4 py-4 text-left"
            onClick={() => pick('motorist')}
            data-testid="role-motorist"
          >
            <LabasIcon name="car" className="h-7 w-7" tone="onInk" aria-hidden />
            <span>
              <span className="block text-lg">{t('role.motorist')}</span>
              <span className="mt-0.5 block text-sm font-normal text-sand/80">
                {t('role.motoristHint')}
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto w-full justify-start gap-4 py-4 text-left"
            onClick={() => pick('broker')}
            data-testid="role-broker"
          >
            <LabasIcon name="briefcase" className="h-7 w-7" tone="onSand" aria-hidden />
            <span>
              <span className="block text-lg">{t('role.broker')}</span>
              <span className="mt-0.5 block text-sm font-normal text-ink-muted">
                {t('role.brokerHint')}
              </span>
            </span>
          </Button>
        </div>
        <p className="mt-5 text-center text-xs text-ink-muted">{t('role.demoNote')}</p>
      </AuthFormCard>
    </AuthSplitLayout>
  )
}
