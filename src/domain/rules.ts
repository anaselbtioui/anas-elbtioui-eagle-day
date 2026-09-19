import type {
  AssistanceOnContract,
  Declaration,
  Dossier,
  Evidence,
  EvidencePack,
  Injury,
  MissingPiece,
  OtherPartyStatus,
  PvStatus,
} from './types.ts'
import { ACAPS_NOTIFY_GUIDANCE } from './types.ts'

export function mustStop(
  injury: Injury,
  otherPartyStatus: OtherPartyStatus | null,
): boolean {
  if (injury === 'yes' || injury === 'unknown') return true
  if (
    otherPartyStatus === 'unknown' ||
    otherPartyStatus === 'refused' ||
    otherPartyStatus === 'fled'
  ) {
    return true
  }
  return false
}

export function derivePv(
  injury: Injury,
  otherPartyStatus: OtherPartyStatus | null,
  current: PvStatus,
): PvStatus {
  if (current === 'obtained') return 'obtained'
  if (mustStop(injury, otherPartyStatus)) return 'required'
  if (injury === 'no' && otherPartyStatus === 'known') return 'not_needed'
  return current
}

export function applyEvidenceRules(pack: EvidencePack): EvidencePack {
  const status = pack.otherParty?.status ?? null
  return {
    ...pack,
    evidence: {
      ...pack.evidence,
      pv: derivePv(pack.incident.injury, status, pack.evidence.pv),
    },
  }
}

export function canSubmit(evidence: Evidence): boolean {
  return evidence.constat === 'complete' || evidence.pv === 'obtained'
}

export function collectMissingPieces(
  pack: EvidencePack,
  policyNumber: string | null,
): MissingPiece[] {
  const missing: MissingPiece[] = []
  if (!canSubmit(pack.evidence)) missing.push('constat_or_pv')
  if (pack.evidence.photos.length === 0) missing.push('photos')
  if (!policyNumber) missing.push('policy_number')
  return missing
}

export function offerAssistance(value: AssistanceOnContract): boolean {
  return value !== 'no'
}

export function dossierAfterDraft(
  declarationId: string,
  pack: EvidencePack,
  policyNumber: string | null,
): Omit<Dossier, 'id'> {
  const missingPieces = collectMissingPieces(pack, policyNumber)
  const blocked = missingPieces.includes('constat_or_pv')
  return {
    declarationId,
    missingPieces,
    status: blocked ? 'blocked_missing_evidence' : 'draft',
    nextHumanStep: blocked
      ? 'Obtenir le constat signé (ou un PV) avant d’envoyer la déclaration.'
      : 'Relire les réponses, puis envoyer la déclaration au courtier.',
    notifiedWithinGuidanceNote: ACAPS_NOTIFY_GUIDANCE,
  }
}

export function dossierAfterSubmit(
  declaration: Declaration,
  pack: EvidencePack,
  policyNumber: string | null,
): Omit<Dossier, 'id'> {
  const missingPieces = collectMissingPieces(pack, policyNumber).filter(
    (p) => p !== 'constat_or_pv',
  )
  const waiting = missingPieces.length > 0
  return {
    declarationId: declaration.id,
    missingPieces,
    status: waiting
      ? 'waiting_motorist'
      : declaration.channel === 'broker'
        ? 'with_broker'
        : 'with_insurer',
    nextHumanStep: waiting
      ? 'Fournir les pièces manquantes. Aucune décision de garantie ou d’indemnisation.'
      : declaration.channel === 'broker'
        ? 'Le courtier transmet le dossier à l’assureur. L’assureur tranchera garanties et suite.'
        : 'Dossier reçu par l’assureur. Pas de décision de garantie ni d’indemnisation dans l’app.',
    notifiedWithinGuidanceNote: ACAPS_NOTIFY_GUIDANCE,
  }
}

export function emptyEvidence(incidentId: string): Evidence {
  return {
    incidentId,
    constat: 'absent',
    pv: 'not_needed',
    damageZones: [],
    photos: [],
  }
}
