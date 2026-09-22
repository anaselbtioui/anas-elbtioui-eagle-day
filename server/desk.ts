import type {
  BrokerTask,
  DeskBundle,
  DeskEvent,
  DocumentRequest,
  MessageDraft,
  Provenance,
} from '../src/domain/desk.ts'
import { displayAccidentRef } from '../src/domain/accident-ref.ts'
import type { Dossier, EvidencePack, Profile } from '../src/domain/types.ts'

export type DeskFile = {
  dossierId: string
  title: string
  provenance: Provenance
  tasks: BrokerTask[]
  requests: DocumentRequest[]
  drafts: MessageDraft[]
  events: DeskEvent[]
}

export function emptyDeskFiles(): DeskFile[] {
  return []
}

export function upsertDeskFile(list: DeskFile[], file: DeskFile): DeskFile[] {
  const i = list.findIndex((x) => x.dossierId === file.dossierId)
  if (i === -1) return [...list, file]
  const next = [...list]
  next[i] = file
  return next
}

export function defaultTitle(pack: EvidencePack): string {
  const city = pack.incident.city ?? 'Sans ville'
  const ref = displayAccidentRef(pack.incident.ref, pack.incident.id)
  if (pack.incident.injury === 'yes' || pack.incident.injury === 'unknown') {
    return `${ref} · Blessure · ${city}`
  }
  if (pack.incident.vehicleImmobilised) return `${ref} · Immobilisé · ${city}`
  return `${ref} · Collision · ${city}`
}

function taskLabelForPiece(piece: string): string {
  switch (piece) {
    case 'constat_or_pv':
      return 'Obtenir le constat signé (ou un PV)'
    case 'photos':
      return 'Collecter les photos'
    case 'policy_number':
      return 'Vérifier le n° de police'
    case 'other':
      return 'Pièce complémentaire'
    default:
      return `Suivre : ${piece}`
  }
}

export function defaultTasks(dossier: Dossier): BrokerTask[] {
  if (dossier.missingPieces.length === 0) {
    return [{ id: `T-${dossier.id}-fwd`, label: 'Transmettre le dossier à l’assureur', done: false }]
  }
  return dossier.missingPieces.map((piece) => ({
    id: `T-${dossier.id}-${piece}`,
    label: taskLabelForPiece(piece),
    done: false,
  }))
}

export function defaultDeskFile(dossier: Dossier, pack: EvidencePack): DeskFile {
  const now = new Date().toISOString()
  return {
    dossierId: dossier.id,
    title: defaultTitle(pack),
    provenance: {
      source: 'Formulaire local',
      freshness: now,
      owner: '—',
    },
    tasks: defaultTasks(dossier),
    requests: [],
    drafts: [],
    events: [
      {
        id: `EVT-${dossier.id}-open`,
        at: now,
        actor: 'system',
        label: 'Dossier ouvert sur le desk',
        motoristVisible: true,
      },
    ],
  }
}

export function deskFileFromBundle(bundle: DeskBundle): DeskFile {
  return {
    dossierId: bundle.dossierId,
    title: bundle.title,
    provenance: bundle.provenance,
    tasks: bundle.tasks,
    requests: bundle.requests,
    drafts: bundle.drafts,
    events: bundle.events ?? [],
  }
}

export function bundleFromParts(
  dossier: Dossier,
  pack: EvidencePack,
  profile: Profile,
  declaration: DeskBundle['declaration'],
  file: DeskFile,
): DeskBundle {
  return {
    dossierId: dossier.id,
    title: file.title,
    profile,
    pack,
    declaration,
    dossier,
    provenance: file.provenance,
    tasks: file.tasks,
    requests: file.requests,
    drafts: file.drafts,
    events: file.events ?? [],
  }
}

export type { BrokerTask, DocumentRequest, MessageDraft, Provenance, DeskEvent }
