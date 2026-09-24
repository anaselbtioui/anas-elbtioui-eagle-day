import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LabasIcon } from '@/components/LabasIcon'
import { PhotoCropDialog } from '@/components/PhotoCropDialog'
import { Button } from '@/components/ui/button'
import { AVATAR_CROP_ASPECT } from '@/lib/crop-image'
import { cn } from '@/lib/utils'

type AvatarPhotoFieldProps = {
  value: string
  onChange: (dataUrl: string) => void
  className?: string
}

/** Circular crop → data URL for settings profile picture. */
export function AvatarPhotoField({ value, onChange, className }: AvatarPhotoFieldProps) {
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
    <div className={cn('flex flex-col items-start gap-4', className)} data-testid="avatar-photo-field">
      <div className="flex items-center gap-4">
        <span
          className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink-soft outline outline-1 outline-ink/15"
          aria-hidden
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <LabasIcon name="user" className="h-10 w-10" tone="onSand" />
          )}
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-ink">{t('motorist.avatarLabel')}</p>
          <p className="text-sm text-ink-muted">{t('motorist.avatarHint')}</p>
        </div>
      </div>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        data-testid="avatar-photo-input"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="flex w-full gap-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          data-testid="avatar-photo-add"
          onClick={() => inputRef.current?.click()}
        >
          {value ? t('onboarding.photoRetake') : t('onboarding.photoAdd')}
        </Button>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            data-testid="avatar-photo-remove"
            onClick={() => onChange('')}
          >
            {t('onboarding.photoRemove')}
          </Button>
        ) : null}
      </div>
      <PhotoCropDialog
        imageSrc={pending}
        aspect={AVATAR_CROP_ASPECT}
        onCancel={() => setPending(null)}
        onConfirm={(dataUrl) => {
          onChange(dataUrl)
          setPending(null)
        }}
      />
    </div>
  )
}
