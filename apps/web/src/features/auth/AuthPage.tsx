import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout, authSplitStyles } from '@/app/AuthSplitLayout'
import { BrandMark } from '@/components/BrandLogo'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/features/auth/GoogleSignInButton'
import { isPersonName } from '@/domain/ma-fields.ts'
import { api } from '@/services/api.ts'
import { useSessionStore, type AppRole } from '@/store/session'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldErrors = {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
}

function authErrorMessage(code: string, t: (k: string) => string): string {
  if (code === 'email_taken') return t('auth.errorTaken')
  if (code === 'invalid_credentials') return t('auth.errorCredentials')
  if (code === 'use_google') return t('auth.errorUseGoogle')
  if (code === 'weak_password') return t('auth.errorWeak')
  if (code === 'name_required') return t('auth.errorName')
  if (code === 'invalid_google_token') return t('auth.errorGoogle')
  if (code === 'google_not_configured') return t('auth.errorGoogleConfig')
  if (code === 'role_required') return t('auth.errorRoleRequired')
  return t('auth.errorGeneric')
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-alert" role="alert">
      {message}
    </p>
  )
}

function AuthField({
  id,
  label,
  icon,
  error,
  errorId,
  trailing,
  className,
  ...inputProps
}: React.ComponentProps<'input'> & {
  id: string
  label: string
  icon: LabasIconName
  error?: string
  errorId: string
  trailing?: ReactNode
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="text-ink-muted">
        {label}
      </Label>
      <div className="relative">
        <span
          className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center"
          aria-hidden
        >
          <LabasIcon name={icon} className="h-5 w-5" tone="onSand" />
        </span>
        <Input
          id={id}
          className={cn('pl-11', trailing ? 'pr-12' : undefined)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          {...inputProps}
        />
        {trailing}
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  )
}

function RolePickerCard({ onPick }: { onPick: (role: AppRole) => void }) {
  const { t } = useTranslation()
  return (
    <AuthFormCard title={t('role.choose')} lead={t('role.lead')}>
      <div className="space-y-3">
        <Button
          className="h-auto w-full justify-start gap-4 py-4 pl-[18px] pr-5 text-left"
          onClick={() => onPick('motorist')}
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
          onClick={() => onPick('broker')}
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
  )
}

/** Guest gate: role picker + credentials share one AuthSplitLayout (no remount flicker). */
export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const role = useSessionStore((s) => s.role)
  const brokerName = useSessionStore((s) => s.brokerName)
  const user = useSessionStore((s) => s.user)
  const setRole = useSessionStore((s) => s.setRole)
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const clearRole = useSessionStore((s) => s.clearRole)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [firstName, setFirstName] = useState(brokerName ?? '')
  const [lastName, setLastName] = useState(brokerName ? 'Desk' : '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  if (user) {
    if (user.role === 'broker') return <Navigate to="/desk" replace />
    return <Navigate to={user.onboarded ? '/' : '/onboarding'} replace />
  }

  const picked = role

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    if (mode === 'signup') {
      if (!firstName.trim()) next.firstName = t('auth.errorFirstName')
      else if (!isPersonName(firstName)) next.firstName = t('auth.errorFirstNameInvalid')
      if (!lastName.trim()) next.lastName = t('auth.errorLastName')
      else if (!isPersonName(lastName)) next.lastName = t('auth.errorLastNameInvalid')
    }
    const emailTrim = email.trim()
    if (!emailTrim) {
      next.email = t('auth.errorEmailRequired')
    } else if (!EMAIL_RE.test(emailTrim)) {
      next.email = t('auth.errorEmailInvalid')
    }
    if (!password) {
      next.password = t('auth.errorPasswordRequired')
    } else if (mode === 'signup' && password.length < 8) {
      next.password = t('auth.errorWeak')
    }
    return next
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!picked) return
    setError(null)
    const next = validate()
    setFieldErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim()
      const session =
        mode === 'signup'
          ? await api.signUp({
              role: picked,
              email: email.trim(),
              password,
              displayName,
            })
          : await api.signIn({ email: email.trim(), password })
      applyAuth(session.token, session.user)
      if (session.user.role === 'broker') {
        navigate('/desk', { replace: true })
        return
      }
      navigate(session.user.onboarded ? '/' : '/onboarding', { replace: true })
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'email_taken') {
        setMode('signin')
        setError(t('auth.errorTaken'))
        return
      }
      setError(authErrorMessage(code, t))
    } finally {
      setBusy(false)
    }
  }

  async function onGoogleCredential(idToken: string) {
    if (!picked || busy) return
    setError(null)
    setBusy(true)
    try {
      const session = await api.signInWithGoogle({ idToken, role: picked })
      applyAuth(session.token, session.user)
      if (session.user.role === 'broker') {
        navigate('/desk', { replace: true })
        return
      }
      navigate(session.user.onboarded ? '/' : '/onboarding', { replace: true })
    } catch (err) {
      setError(authErrorMessage(err instanceof Error ? err.message : '', t))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'signup' ? t('auth.signupTitle') : t('auth.signinTitle')
  const brandTitle = picked ? t('app.tagline') : t('role.title')
  const brandBody = !picked
    ? t('role.body')
    : picked === 'broker'
      ? t('auth.brokerBody')
      : t('auth.motoristBody')

  return (
    <AuthSplitLayout
      brandTitle={brandTitle}
      brandBody={brandBody}
      mobileHero={
        <div className="mb-2 space-y-2 text-center">
          <BrandMark size="lg" className="mx-auto" />
          <p className="font-display text-2xl font-bold text-ink">{brandTitle}</p>
          <p className="text-sm text-ink-muted">{brandBody}</p>
        </div>
      }
    >
      <div>
        {!picked ? (
          <RolePickerCard onPick={setRole} />
        ) : (
          <div className={authSplitStyles.flowPane}>
          <AuthFormCard title={title}>
            <form className="space-y-4" noValidate onSubmit={(e) => void onSubmit(e)}>
              <div
                role="tablist"
                aria-label={t('auth.modeLabel')}
                className="grid grid-cols-2 gap-2"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signin'}
                  data-testid="auth-mode-signin"
                  className={cn(
                    'min-h-11 rounded-full border-2 px-3 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]',
                    mode === 'signin'
                      ? 'border-sand-deep bg-sand-deep text-ink'
                      : 'border-border bg-transparent text-ink hover:border-ink/40',
                  )}
                  onClick={() => {
                    setMode('signin')
                    setError(null)
                    setFieldErrors({})
                  }}
                >
                  {t('auth.tabSignin')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'signup'}
                  data-testid="auth-mode-signup"
                  className={cn(
                    'min-h-11 rounded-full border-2 px-3 text-sm font-semibold transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98]',
                    mode === 'signup'
                      ? 'border-sand-deep bg-sand-deep text-ink'
                      : 'border-border bg-transparent text-ink hover:border-ink/40',
                  )}
                  onClick={() => {
                    setMode('signup')
                    setError(null)
                    setFieldErrors({})
                  }}
                >
                  {t('auth.tabSignup')}
                </button>
              </div>
              {mode === 'signup' ? (
                <div className="grid grid-cols-2 gap-3">
                  <AuthField
                    id="auth-first-name"
                    label={t('auth.firstName')}
                    icon="user"
                    name="given-name"
                    autoComplete="given-name"
                    value={firstName}
                    error={fieldErrors.firstName}
                    errorId="auth-first-name-error"
                    onChange={(e) => {
                      setFirstName(e.target.value)
                      if (fieldErrors.firstName) {
                        setFieldErrors((f) => ({ ...f, firstName: undefined }))
                      }
                    }}
                  />
                  <AuthField
                    id="auth-last-name"
                    label={t('auth.lastName')}
                    icon="user"
                    name="family-name"
                    autoComplete="family-name"
                    value={lastName}
                    error={fieldErrors.lastName}
                    errorId="auth-last-name-error"
                    onChange={(e) => {
                      setLastName(e.target.value)
                      if (fieldErrors.lastName) {
                        setFieldErrors((f) => ({ ...f, lastName: undefined }))
                      }
                    }}
                  />
                </div>
              ) : null}
              <AuthField
                id="auth-email"
                label={t('auth.email')}
                icon="mail"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                error={fieldErrors.email}
                errorId="auth-email-error"
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) setFieldErrors((f) => ({ ...f, email: undefined }))
                }}
              />
              <AuthField
                id="auth-password"
                label={t('auth.password')}
                icon="lock"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                error={fieldErrors.password}
                errorId="auth-password-error"
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }))
                }}
                trailing={
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-ink-muted transition-[transform,color] duration-150 ease-out hover:text-ink active:scale-[0.96]"
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    data-testid="auth-toggle-password"
                  >
                    <LabasIcon
                      name={showPassword ? 'eyeOff' : 'eye'}
                      className="h-5 w-5"
                      tone="onSand"
                      aria-hidden
                    />
                  </button>
                }
              />
              {error ? (
                <p className="text-sm text-alert" role="alert">
                  {error}
                </p>
              ) : null}
              <Button className="w-full" type="submit" loading={busy} data-testid="auth-submit">
                {mode === 'signup' ? t('auth.submitSignup') : t('auth.submitSignin')}
              </Button>
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <span className="w-full border-t border-border" />
                </div>
                <p className="relative mx-auto w-fit bg-surface px-2 text-xs font-medium text-ink-muted">
                  {t('auth.or')}
                </p>
              </div>
              <GoogleSignInButton disabled={busy} onCredential={(token) => void onGoogleCredential(token)} />
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
                onClick={() => {
                  clearRole()
                  navigate('/', { replace: true })
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0 rtl:-scale-x-100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M19 12H5M11 18l-6-6 6-6" />
                </svg>
                {t('app.back')}
              </button>
            </form>
          </AuthFormCard>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  )
}
