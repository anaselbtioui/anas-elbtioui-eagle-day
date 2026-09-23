import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { RotateCcw, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cropImageToDataUrl } from '@/lib/crop-image'

type PhotoCropDialogProps = {
  imageSrc: string | null
  aspect: number
  onCancel: () => void
  onConfirm: (dataUrl: string) => void
}

export function PhotoCropDialog({ imageSrc, aspect, onCancel, onConfirm }: PhotoCropDialogProps) {
  const { t } = useTranslation()
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setPixels(null)
    setBusy(false)
  }, [imageSrc])

  async function confirm() {
    if (!imageSrc || !pixels || busy) return
    setBusy(true)
    try {
      const dataUrl = await cropImageToDataUrl(imageSrc, pixels, rotation)
      onConfirm(dataUrl)
    } catch {
      setBusy(false)
    }
  }

  return (
    <Dialog.Root
      open={Boolean(imageSrc)}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="labas-overlay fixed inset-0 z-[70] bg-ink/60" />
        <Dialog.Content
          className="labas-dialog-panel fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[71] mx-auto flex max-h-[min(40rem,calc(100dvh-1.5rem))] w-[min(36rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[1.25rem] border border-border bg-surface shadow-[0_24px_80px_-24px_rgba(16,40,96,0.45)] outline-none"
          data-testid="photo-crop-dialog"
          aria-describedby={undefined}
        >
          <div className="border-b border-border/70 px-5 py-4">
            <Dialog.Title className="font-display text-lg font-bold text-ink">
              {t('crop.title')}
            </Dialog.Title>
            <p className="mt-1 text-sm text-ink-muted">{t('crop.hint')}</p>
          </div>
          <div className="relative min-h-64 flex-1 bg-ink">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_area, croppedPixels) => setPixels(croppedPixels)}
              />
            ) : null}
          </div>
          <div className="space-y-3 px-5 py-4">
            <label className="block text-sm font-medium text-ink-muted">
              {t('crop.zoom')}
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="mt-2 block w-full accent-ink"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={zoom}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={busy}
                onClick={() => setRotation((value) => (value + 270) % 360)}
                aria-label={t('crop.rotateLeft')}
                data-testid="photo-crop-rotate-left"
              >
                <RotateCcw className="h-5 w-5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={busy}
                onClick={() => setRotation((value) => (value + 90) % 360)}
                aria-label={t('crop.rotateRight')}
                data-testid="photo-crop-rotate-right"
              >
                <RotateCw className="h-5 w-5" aria-hidden />
              </Button>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
                  {t('crop.cancel')}
                </Button>
                <Button
                  type="button"
                  disabled={busy || !pixels}
                  onClick={() => void confirm()}
                  data-testid="photo-crop-confirm"
                >
                  {t('crop.confirm')}
                </Button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
