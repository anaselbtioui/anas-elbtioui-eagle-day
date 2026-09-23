import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthFormCard, AuthSplitLayout } from '@/app/AuthSplitLayout'
import { LabasIcon, type LabasIconName } from '@/components/LabasIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { isPersonName } from '@/domain/ma-fields.ts'
import { api } from '@/services/api.ts'
import { useSessionStore } from '@/store/session'
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
  if (code === 'weak_password') return t('auth.errorWeak')
  if (code === 'name_required') return t('auth.errorName')
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

export function AuthPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const role = useSessionStore((s) => s.role)
  const brokerName = useSessionStore((s) => s.brokerName)
  const user = useSessionStore((s) => s.user)
  const applyAuth = useSessionStore((s) => s.applyAuth)
  const clearRole = useSessionStore((s) => s.clearRole)
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [firstName, setFirstName] = useState(brokerName ?? '')
  const [lastName, setLastName] = useState(brokerName ? 'Desk' : '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  if (!role) return <Navigate to="/" replace />
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

  const title = mode === 'signup' ? t('auth.signupTitle') : t('auth.signinTitle')
  const brandBody = picked === 'broker' ? t('auth.brokerBody') : t('auth.motoristBody')

  return (
    <AuthSplitLayout
      brandTitle={t('app.tagline')}
      brandBody={brandBody}
      mobileHero={
        <div className="mb-2 space-y-1 text-center">
          <p className="font-display text-lg font-bold text-ink">{t('app.tagline')}</p>
          <p className="text-sm text-ink-muted">{brandBody}</p>
        </div>
      }
    >
      <AuthFormCard title={title}>
        <form className="space-y-4" noValidate onSubmit={(e) => void onSubmit(e)}>
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
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
            <button
              type="button"
              className="min-h-10 text-sm font-medium text-ink-muted underline-offset-4 hover:underline"
              data-testid="auth-toggle"
              onClick={() => {
                setMode(mode === 'signup' ? 'signin' : 'signup')
                setError(null)
                setFieldErrors({})
              }}
            >
              {mode === 'signup' ? t('auth.hasAccount') : t('auth.noAccount')}
            </button>
          </div>
        </form>
      </AuthFormCard>
    </AuthSplitLayout>
  )
}
