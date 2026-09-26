import { useEffect, useState } from 'react'
import { ReleaseNotesDialog } from '@/components/ReleaseNotesDialog'
import type { ReleaseNote } from '@/releases/catalog.ts'
import { latestUnseenRelease, markReleaseSeen } from '@/releases/seen.ts'

type ReleaseNotesHostProps = {
  audience: 'motorist' | 'broker'
}

/** Shows the latest undismissed release note for this shell audience. */
export function ReleaseNotesHost({ audience }: ReleaseNotesHostProps) {
  const [release, setRelease] = useState<ReleaseNote | null>(null)

  useEffect(() => {
    const pending = latestUnseenRelease(audience)
    if (!pending) return
    const t = window.setTimeout(() => setRelease(pending), 600)
    return () => window.clearTimeout(t)
  }, [audience])

  function dismiss() {
    if (release) markReleaseSeen(audience, release.id)
    setRelease(null)
  }

  if (!release) return null
  return <ReleaseNotesDialog release={release} open onDismiss={dismiss} />
}
