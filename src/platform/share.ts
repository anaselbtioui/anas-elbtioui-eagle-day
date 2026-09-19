function isNative(): boolean {
  return Boolean(
    (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  )
}

async function loadOptional(specifier: string): Promise<unknown> {
  try {
    return await import(/* @vite-ignore */ specifier)
  } catch {
    return null
  }
}

export async function shareText(title: string, text: string): Promise<boolean> {
  if (isNative()) {
    const mod = (await loadOptional('@capacitor/share')) as {
      Share?: {
        share: (opts: { title: string; text: string; dialogTitle: string }) => Promise<void>
      }
    } | null
    if (mod?.Share) {
      await mod.Share.share({ title, text, dialogTitle: title })
      return true
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return true
    } catch {
      return false
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
