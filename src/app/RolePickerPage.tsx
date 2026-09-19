import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout } from '@/app/AuthSplitLayout'
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
    <AuthSplitLayout brandTitle={t('role.title')}>
      <AuthFormCard title={t('role.choose')}>
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
      </AuthFormCard>
    </AuthSplitLayout>
  )
}
