import type { NavigateFunction } from 'react-router-dom'
import { isNowDraftExpired, type EvidencePack } from '@/domain/evidence'

/** Route a pack click to NOW / LATER / Passés by status (+ NOW draft TTL). */
export function openMotoristPack(args: {
  pack: EvidencePack | undefined
  packId: string
  resume: (id: string) => boolean
  navigate: NavigateFunction
  claimReady: boolean
  onLaterBlocked?: () => void
  onExpired?: () => void
}): void {
  const { pack, packId, resume, navigate, claimReady, onLaterBlocked, onExpired } = args
  if (!pack) {
    navigate(`/past/${packId}`)
    return
  }
  if (pack.status === 'expired' || isNowDraftExpired(pack)) {
    onExpired?.()
    navigate(`/past/${packId}`)
    return
  }
  if (pack.status === 'draft') {
    const ok = resume(packId)
    if (!ok) {
      onExpired?.()
      navigate(`/past/${packId}`)
      return
    }
    navigate('/now')
    return
  }
  if (pack.status === 'saved') {
    if (!claimReady) {
      onLaterBlocked?.()
      return
    }
    resume(packId)
    navigate('/later')
    return
  }
  navigate(`/past/${packId}`)
}
