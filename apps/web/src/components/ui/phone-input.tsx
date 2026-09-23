import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  MOROCCO_DIAL_CODE,
  applyInternationalTypedInput,
  buildE164FromNationalDisplay,
  countryCodeToFlagEmoji,
  digitsOnly,
  formatNationalDigits,
  isValidMoroccanPhone,
  parseE164ToNationalParts,
} from '@/lib/phone'

export type PhoneInputProps = {
  value: string
  onChange: (e164: string) => void
  label?: string
  error?: string
  required?: boolean
  disabled?: boolean
  className?: string
  /** Wallet gap resume — alert border on the national digits field. */
  highlight?: boolean
  id?: string
  hint?: string
  /** Inline error while digits present but not yet valid MA E.164. Default true. */
  validateRealtime?: boolean
  onValidityChange?: (valid: boolean) => void
}

function MoroccoFlag({ className }: { className?: string }) {
  const [imgBroken, setImgBroken] = useState(false)
  if (imgBroken) {
    return (
      <span className={cn('text-base leading-none', className)} aria-hidden>
        {countryCodeToFlagEmoji('MA')}
      </span>
    )
  }
  return (
    <img
      className={cn('h-4 w-[22px] shrink-0 rounded-sm object-cover outline outline-1 outline-ink/10', className)}
      src="https://flagcdn.com/w40/ma.png"
      alt=""
      width={22}
      height={16}
      loading="lazy"
      decoding="async"
      onError={() => setImgBroken(true)}
    />
  )
}

/**
 * Morocco-locked phone field (wa-pharma PhoneInput pattern).
 * Emits E.164 only when valid (+212…); country selector fixed to MA.
 */
export function PhoneInput({
  value,
  onChange,
  label,
  error,
  required,
  disabled,
  className,
  highlight = false,
  id,
  hint,
  validateRealtime = true,
  onValidityChange,
}: PhoneInputProps) {
  const { t } = useTranslation()
  const [nationalFocused, setNationalFocused] = useState(false)
  const [nationalText, setNationalText] = useState('')
  const [foreignAttempt, setForeignAttempt] = useState(false)
  const prevExternalValueRef = useRef(value)

  useEffect(() => {
    if (nationalFocused) return
    if (!value?.trim()) {
      const prev = prevExternalValueRef.current
      prevExternalValueRef.current = value
      if (prev?.trim()) {
        setNationalText('')
        setForeignAttempt(false)
        return
      }
      setNationalText((txt) => (digitsOnly(txt) ? txt : ''))
      return
    }

    prevExternalValueRef.current = value
    if (!isValidMoroccanPhone(value)) {
      setNationalText('')
      return
    }
    const parts = parseE164ToNationalParts(value)
    setNationalText(parts.nationalDisplay)
    setForeignAttempt(false)
  }, [value, nationalFocused])

  const hasNationalDigits = digitsOnly(nationalText).length > 0

  const currentE164 = useMemo(
    () => buildE164FromNationalDisplay(nationalText),
    [nationalText],
  )

  const realtimeError = useMemo(() => {
    if (foreignAttempt) return t('phone.moroccoOnly')
    if (!validateRealtime || !hasNationalDigits) return undefined
    if (currentE164 && isValidMoroccanPhone(currentE164)) return undefined
    return t('phone.invalid')
  }, [foreignAttempt, validateRealtime, hasNationalDigits, currentE164, t])

  const displayError = error ?? realtimeError

  useEffect(() => {
    if (!onValidityChange) return
    const valid =
      !hasNationalDigits || (!!currentE164 && isValidMoroccanPhone(currentE164))
    onValidityChange(valid && !foreignAttempt)
  }, [hasNationalDigits, currentE164, onValidityChange, foreignAttempt])

  function handleNationalChange(raw: string) {
    const intl = applyInternationalTypedInput(raw)
    if (intl) {
      if (intl.foreignCountry) {
        setForeignAttempt(true)
        setNationalText('')
        onChange('')
        return
      }
      setForeignAttempt(false)
      setNationalText(intl.nationalDisplay)
      onChange(intl.e164 || '')
      return
    }

    setForeignAttempt(false)
    const digits = digitsOnly(raw)
    if (!digits) {
      setNationalText('')
      onChange('')
      return
    }
    const formatted = formatNationalDigits(digits)
    setNationalText(formatted)
    const e164 = buildE164FromNationalDisplay(formatted)
    onChange(e164 || '')
  }

  function handleNationalBlur() {
    setNationalFocused(false)
    const e164 = buildE164FromNationalDisplay(nationalText)
    if (e164 && isValidMoroccanPhone(e164)) {
      onChange(e164)
    } else if (!digitsOnly(nationalText)) {
      onChange('')
    }
  }

  const nationalId = id ? `${id}-national` : 'phone-national'
  const errorId = `${nationalId}-error`

  return (
    <div className={cn('space-y-2', className)} data-testid="phone-input">
      {label ? (
        <Label htmlFor={nationalId}>
          {label}
          {required ? ' *' : ''}
        </Label>
      ) : null}

      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            'flex min-h-12 shrink-0 items-center gap-2 rounded-[var(--radius-labas)] border border-border bg-surface px-3',
            (displayError || highlight) && 'border-alert',
            disabled && 'opacity-50',
          )}
          aria-hidden
          data-testid="phone-ma-prefix"
        >
          <MoroccoFlag />
          <span className="font-mono text-base font-semibold tabular-nums tracking-wide text-ink">
            {MOROCCO_DIAL_CODE}
          </span>
        </div>

        <Input
          id={nationalId}
          className={cn(
            'min-w-0 flex-1 font-mono text-base tracking-wide tabular-nums',
            (displayError || highlight) && 'border-alert',
            highlight && 'ring-2 ring-alert/35',
          )}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          required={required}
          value={nationalText}
          aria-invalid={!!displayError || highlight}
          aria-describedby={displayError ? errorId : undefined}
          onChange={(e) => handleNationalChange(e.currentTarget.value)}
          onFocus={() => setNationalFocused(true)}
          onBlur={handleNationalBlur}
        />
      </div>

      {hint && !displayError ? (
        <p className="text-xs text-ink-muted">{hint}</p>
      ) : null}
      {displayError ? (
        <p id={errorId} className="text-sm text-alert" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  )
}
