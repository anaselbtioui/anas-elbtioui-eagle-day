import type { DossierStatus } from './types.ts'
import type { EvidencePackStatus } from './evidence.ts'
import type { LifecycleTone } from './lifecycle-tone.ts'

export type LifecycleStageState = 'done' | 'active' | 'pending' | 'cancelled'

export type LifecycleStage = {
  id: string
  /** i18n key under `lifecycle.*` */
  titleKey: string
  state: LifecycleStageState
  tone: LifecycleTone
}

export type LifecycleSegment = {
  id: string
  tone: LifecycleTone
}

function segment(stage: LifecycleStage): LifecycleSegment {
  return { id: stage.id, tone: stage.tone }
}

/**
 * Dossier spine (broker + motorist LATER):
 * Collecte → Déclaration → Desk → Assureur
 */
export function dossierLifecycleStages(status: DossierStatus): LifecycleStage[] {
  const collectTone: LifecycleTone =
    status === 'blocked_missing_evidence'
      ? 'red'
      : status === 'draft'
        ? 'amber'
        : 'green'
  const collectState: LifecycleStageState =
    status === 'blocked_missing_evidence'
      ? 'active'
      : status === 'draft'
        ? 'active'
        : 'done'

  const declareTone: LifecycleTone =
    status === 'draft' || status === 'blocked_missing_evidence'
      ? 'gray'
      : status === 'declared'
        ? 'amber'
        : 'green'
  const declareState: LifecycleStageState =
    status === 'draft' || status === 'blocked_missing_evidence'
      ? 'pending'
      : status === 'declared'
        ? 'active'
        : 'done'

  let deskTone: LifecycleTone = 'gray'
  let deskState: LifecycleStageState = 'pending'
  if (status === 'waiting_motorist') {
    deskTone = 'amber'
    deskState = 'active'
  } else if (status === 'with_broker') {
    deskTone = 'green'
    deskState = 'active'
  } else if (status === 'with_insurer') {
    deskTone = 'green'
    deskState = 'done'
  }

  const insurerTone: LifecycleTone = status === 'with_insurer' ? 'blue' : 'gray'
  const insurerState: LifecycleStageState = status === 'with_insurer' ? 'done' : 'pending'

  return [
    {
      id: 'collect',
      titleKey: 'lifecycle.dossier.collect',
      state: collectState,
      tone: collectTone,
    },
    {
      id: 'declare',
      titleKey: 'lifecycle.dossier.declare',
      state: declareState,
      tone: declareTone,
    },
    {
      id: 'desk',
      titleKey: 'lifecycle.dossier.desk',
      state: deskState,
      tone: deskTone,
    },
    {
      id: 'insurer',
      titleKey: 'lifecycle.dossier.insurer',
      state: insurerState,
      tone: insurerTone,
    },
  ]
}

export function dossierLifecycleSegments(status: DossierStatus): LifecycleSegment[] {
  return dossierLifecycleStages(status).map(segment)
}

/** Dominant urgency tone for filters / a11y (worst segment wins). */
export function dossierDominantTone(status: DossierStatus): LifecycleTone {
  const tones = dossierLifecycleSegments(status).map((s) => s.tone)
  if (tones.includes('red')) return 'red'
  if (tones.includes('amber')) return 'amber'
  if (tones.includes('blue')) return 'blue'
  if (tones.includes('green')) return 'green'
  return 'gray'
}

/**
 * NOW pack (sur place): Collecte → Prêt → Clos
 * Clos = stopped | expired (terminal).
 */
export function packLifecycleStages(status: EvidencePackStatus): LifecycleStage[] {
  switch (status) {
    case 'draft':
      return [
        {
          id: 'collect',
          titleKey: 'lifecycle.pack.collect',
          state: 'active',
          tone: 'amber',
        },
        {
          id: 'ready',
          titleKey: 'lifecycle.pack.ready',
          state: 'pending',
          tone: 'gray',
        },
        {
          id: 'closed',
          titleKey: 'lifecycle.pack.closed',
          state: 'pending',
          tone: 'gray',
        },
      ]
    case 'saved':
      return [
        {
          id: 'collect',
          titleKey: 'lifecycle.pack.collect',
          state: 'done',
          tone: 'green',
        },
        {
          id: 'ready',
          titleKey: 'lifecycle.pack.ready',
          state: 'active',
          tone: 'green',
        },
        {
          id: 'closed',
          titleKey: 'lifecycle.pack.closed',
          state: 'pending',
          tone: 'gray',
        },
      ]
    case 'stopped':
      return [
        {
          id: 'collect',
          titleKey: 'lifecycle.pack.collect',
          state: 'cancelled',
          tone: 'red',
        },
        {
          id: 'ready',
          titleKey: 'lifecycle.pack.ready',
          state: 'pending',
          tone: 'gray',
        },
        {
          id: 'closed',
          titleKey: 'lifecycle.pack.closed',
          state: 'cancelled',
          tone: 'red',
        },
      ]
    case 'expired':
      return [
        {
          id: 'collect',
          titleKey: 'lifecycle.pack.collect',
          state: 'done',
          tone: 'amber',
        },
        {
          id: 'ready',
          titleKey: 'lifecycle.pack.ready',
          state: 'pending',
          tone: 'gray',
        },
        {
          id: 'closed',
          titleKey: 'lifecycle.pack.closed',
          state: 'cancelled',
          tone: 'red',
        },
      ]
  }
}

export function packLifecycleSegments(status: EvidencePackStatus): LifecycleSegment[] {
  return packLifecycleStages(status).map(segment)
}
