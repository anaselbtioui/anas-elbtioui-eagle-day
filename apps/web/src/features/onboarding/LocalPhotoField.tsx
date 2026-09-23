import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PhotoCropDialog } from '@/components/PhotoCropDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { DOCUMENT_CROP_ASPECT } from '@/lib/crop-image'

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
  const [pending, setPending] = useState<string | null>(null)

  function onFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setPending(result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      {value ? (
        <div className="overflow-hidden rounded-[var(--radius-labas)] border border-border bg-sand-deep">
          <img
            src={value}
            alt=""
            className="max-h-40 w-full object-contain shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1)]"
          />
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
      <PhotoCropDialog
        imageSrc={pending}
        aspect={DOCUMENT_CROP_ASPECT}
        onCancel={() => setPending(null)}
        onConfirm={(dataUrl) => {
          onChange(dataUrl)
          setPending(null)
        }}
      />
    </div>
  )
}
