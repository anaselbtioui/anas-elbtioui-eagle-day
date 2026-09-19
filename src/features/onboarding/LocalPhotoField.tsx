import { useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type LocalPhotoFieldProps = {
  label: string
  value: string
  onChange: (dataUrl: string) => void
  hint?: string
}

/** Camera/gallery → data URL stored only in local wallet (never uploaded). */
export function LocalPhotoField({ label, value, onChange, hint }: LocalPhotoFieldProps) {
  const { t } = useTranslation()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') onChange(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      {value ? (
        <div className="overflow-hidden rounded-[var(--radius-labas)] border border-border bg-sand-deep">
          <img src={value} alt="" className="max-h-40 w-full object-contain" />
        </div>
      ) : null}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
        >
          {value ? t('onboarding.photoRetake') : t('onboarding.photoAdd')}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" onClick={() => onChange('')}>
            {t('onboarding.photoRemove')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
