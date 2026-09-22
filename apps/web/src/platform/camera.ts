function isNative(): boolean {
  return Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  )
}

/** Dynamic optional peer — string kept out of static module graph. */
async function loadOptional(specifier: string): Promise<unknown> {
  try {
    return await import(/* @vite-ignore */ specifier)
  } catch {
    return null
  }
}

export async function takePhoto(): Promise<string | null> {
  if (isNative()) {
    const mod = (await loadOptional('@capacitor/camera')) as {
      Camera?: {
        getPhoto: (opts: Record<string, unknown>) => Promise<{ dataUrl?: string }>
      }
      CameraResultType?: { DataUrl: string }
      CameraSource?: { Camera: string }
    } | null
    if (mod?.Camera && mod.CameraResultType && mod.CameraSource) {
      const photo = await mod.Camera.getPhoto({
        quality: 80,
        resultType: mod.CameraResultType.DataUrl,
        source: mod.CameraSource.Camera,
      })
      return photo.dataUrl ?? null
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

export async function pickFromGallery(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) {
        resolve(null)
        return
      }
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
