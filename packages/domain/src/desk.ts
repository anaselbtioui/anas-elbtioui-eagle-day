import type {
  Declaration,
  Dossier,
  EvidencePack,
  MissingPiece,
  Profile,
} from './types.ts'

/** Desk-only. Outside motorist v1. Same dossier ids. */

export type Provenance = {
  source: string
  freshness: string
  owner: string
}

export type BrokerTask = {
  id: string
  label: string
  done: boolean
}

export type DocumentRequestPiece = MissingPiece | 'assistance_verify' | 'pv'

export type DocumentRequest = {
  id: string
  dossierId: string
  piece: DocumentRequestPiece
  note: string
  createdAt: string
}

export type MessageIntent = 'missing_piece' | 'human_callback' | 'next_step'

export type MessageDraft = {
  id: string
  dossierId: string
  intent: MessageIntent
  body: string
  humanApproved: boolean
  approvedAt: string | null
}

export type DeskEventActor = 'motorist' | 'broker' | 'system'

export type DeskEvent = {
  id: string
  at: string
  actor: DeskEventActor
  label: string
  motoristVisible: boolean
}

export type DeskBundle = {
  dossierId: string
  title: string
  profile: Profile
  pack: EvidencePack
  declaration: Declaration | null
  dossier: Dossier
  provenance: Provenance
  tasks: BrokerTask[]
  requests: DocumentRequest[]
  drafts: MessageDraft[]
  events: DeskEvent[]
  /** Motorist's Labas login soft-deleted; dossier may still sit on desk. */
  motoristAccountDeleted: boolean
}

export function appendEvent(
  bundle: DeskBundle,
  actor: DeskEventActor,
  label: string,
  motoristVisible = true,
  now = new Date().toISOString(),
): DeskBundle {
  const event: DeskEvent = {
    id: `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: now,
    actor,
    label,
    motoristVisible,
  }
  return { ...bundle, events: [event, ...bundle.events] }
}

export type DeskQueueFilters = {
  query: string
  /** `all` = open files only. `closed` = motorist-closed. Else pipeline status among open. */
  status: Dossier['status'] | 'all' | 'closed'
  mineOnly: boolean
  brokerName: string | null
}

function isDossierClosed(dossier: Dossier): boolean {
  return Boolean(dossier.closedReason)
}

/** Client-side queue search: name / contrat / city + status + owner. */
export function filterDeskBundles(
  bundles: DeskBundle[],
  filters: DeskQueueFilters,
): DeskBundle[] {
  const q = filters.query.trim().toLowerCase()
  return bundles
    .filter((b) => {
      const closed = isDossierClosed(b.dossier)
      if (filters.status === 'closed') {
        if (!closed) return false
      } else if (filters.status === 'all') {
        if (closed) return false
      } else {
        if (closed) return false
        if (b.dossier.status !== filters.status) return false
      }
      if (filters.mineOnly && filters.brokerName && b.provenance.owner !== filters.brokerName) {
        return false
      }
      if (!q) return true
      const hay = [
        b.profile.motorist.name,
        b.profile.policy.number ?? '',
        b.pack.incident.city ?? '',
        b.title,
        b.provenance.owner,
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => b.provenance.freshness.localeCompare(a.provenance.freshness))
}

export function draftTemplate(
  intent: MessageIntent,
  motoristName: string,
  pieceLabel?: string,
): string {
  switch (intent) {
    case 'missing_piece':
      return `Bonjour ${motoristName},\n\nPour avancer sur votre dossier, merci de nous transmettre : ${pieceLabel ?? 'la pièce manquante'}.\n\nCeci n’est pas une décision de garantie ni d’indemnisation.\n\nCordialement,\nVotre courtier`
    case 'human_callback':
      return `Bonjour ${motoristName},\n\nNous proposons un rappel humain pour faire le point sur votre dossier. Indiquez un créneau qui vous convient.\n\nAucune décision de couverture n’est prise ici.\n\nCordialement,\nVotre courtier`
    case 'next_step':
      return `Bonjour ${motoristName},\n\nProchaine étape humaine : ${pieceLabel ?? 'fournir les éléments demandés'}. Nous restons disponibles.\n\nCordialement,\nVotre courtier`
  }
}

export function requestDocument(
  bundle: DeskBundle,
  piece: DocumentRequestPiece,
  note: string,
  now = new Date().toISOString(),
): DeskBundle {
  const id = `REQ-${Date.now()}`
  const request: DocumentRequest = {
    id,
    dossierId: bundle.dossierId,
    piece,
    note,
    createdAt: now,
  }
  const taskLabel =
    piece === 'constat_or_pv'
      ? 'Relancer : constat ou PV'
      : piece === 'photos'
        ? 'Relancer : photos'
        : piece === 'policy_number'
          ? 'Relancer : n° de contrat'
          : piece === 'assistance_verify'
            ? 'Vérifier le n° d’assistance avec le client'
            : piece === 'pv'
              ? 'Relancer : PV'
              : 'Relancer : autre pièce'

  const missing = new Set(bundle.dossier.missingPieces)
  if (piece === 'constat_or_pv' || piece === 'photos' || piece === 'policy_number' || piece === 'other') {
    missing.add(piece)
  }
  if (piece === 'pv') missing.add('constat_or_pv')

  const next: DeskBundle = {
    ...bundle,
    requests: [request, ...bundle.requests],
    tasks: [{ id: `T-${id}`, label: taskLabel, done: false }, ...bundle.tasks],
    dossier: {
      ...bundle.dossier,
      status: 'waiting_motorist',
      missingPieces: [...missing],
      nextHumanStep:
        note ||
        'Le motoriste doit fournir la pièce demandée. Aucune décision de garantie.',
    },
  }
  return appendEvent(next, 'broker', `Demande de pièce : ${taskLabel}`, true, now)
}

export type ApproveDraftResult =
  | { ok: true; bundle: DeskBundle }
  | { ok: false; reason: 'not_human_approved' | 'draft_missing' }

export function setDraftHumanApproved(
  bundle: DeskBundle,
  draftId: string,
  humanApproved: boolean,
): DeskBundle {
  return {
    ...bundle,
    drafts: bundle.drafts.map((d) =>
      d.id === draftId ? { ...d, humanApproved } : d,
    ),
  }
}

export function setDraftBody(
  bundle: DeskBundle,
  draftId: string,
  body: string,
): DeskBundle {
  return {
    ...bundle,
    drafts: bundle.drafts.map((d) =>
      d.id === draftId ? { ...d, body, humanApproved: false, approvedAt: null } : d,
    ),
  }
}

export function createDraft(
  bundle: DeskBundle,
  intent: MessageIntent,
  pieceLabel?: string,
): DeskBundle {
  const id = `MSG-${Date.now()}`
  const draft: MessageDraft = {
    id,
    dossierId: bundle.dossierId,
    intent,
    body: draftTemplate(intent, bundle.profile.motorist.name, pieceLabel),
    humanApproved: false,
    approvedAt: null,
  }
  return appendEvent(
    { ...bundle, drafts: [draft, ...bundle.drafts] },
    'broker',
    'Brouillon message créé',
    false,
  )
}

export function approveDraft(
  bundle: DeskBundle,
  draftId: string,
  now = new Date().toISOString(),
): ApproveDraftResult {
  const draft = bundle.drafts.find((d) => d.id === draftId)
  if (!draft) return { ok: false, reason: 'draft_missing' }
  if (!draft.humanApproved) return { ok: false, reason: 'not_human_approved' }
  const next: DeskBundle = {
    ...bundle,
    drafts: bundle.drafts.map((d) =>
      d.id === draftId ? { ...d, approvedAt: now } : d,
    ),
  }
  return {
    ok: true,
    bundle: appendEvent(
      next,
      'broker',
      'Brouillon approuvé localement (aucun envoi)',
      false,
      now,
    ),
  }
}

export function toggleTask(bundle: DeskBundle, taskId: string): DeskBundle {
  const task = bundle.tasks.find((t) => t.id === taskId)
  const next: DeskBundle = {
    ...bundle,
    tasks: bundle.tasks.map((t) =>
      t.id === taskId ? { ...t, done: !t.done } : t,
    ),
  }
  if (!task) return next
  return appendEvent(
    next,
    'broker',
    task.done ? `Tâche rouverte : ${task.label}` : `Tâche faite : ${task.label}`,
    false,
  )
}

export function setOwner(bundle: DeskBundle, owner: string): DeskBundle {
  return appendEvent(
    {
      ...bundle,
      provenance: { ...bundle.provenance, owner },
    },
    'broker',
    `Référent desk : ${owner}`,
    false,
  )
}

export function handoffToInsurer(bundle: DeskBundle): DeskBundle | { error: 'has_gaps' } {
  if (bundle.dossier.missingPieces.length > 0) return { error: 'has_gaps' }
  const next: DeskBundle = {
    ...bundle,
    dossier: {
      ...bundle.dossier,
      status: 'with_insurer',
      nextHumanStep:
        'Transmis à l’assureur. L’assureur tranche garanties et suite. Aucune décision dans l’app.',
    },
  }
  return appendEvent(next, 'broker', 'Dossier transmis à l’assureur', true)
}
