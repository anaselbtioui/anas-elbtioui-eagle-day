import type { DossierStatus } from './types.ts'
import { isDeclareGuidanceExpired, type EvidencePackStatus } from './evidence.ts'
import type { LifecycleTone } from './lifecycle-tone.ts'

export type LifecycleStageState = 'done' | 'active' | 'pending' | 'cancelled'

/**
 * Gate outside the accident. Completing it does not change pack status.
 * `wallet` = identity, vehicle, contract, and broker are still incomplete.
 */
export type LifecycleBlock = {
  /** `wallet` is outside the accident. `declareWindow` is the 5-day guidance display. */
  id: 'wallet' | 'declareWindow'
  /** i18n key under `lifecycle.*` */
  titleKey: string
}

export type LifecycleStage = {
  id: string
  /** i18n key under `lifecycle.*` */
  titleKey: string
  state: LifecycleStageState
  tone: LifecycleTone
  /** Present while this stage cannot advance. */
  block?: LifecycleBlock
}

export type PackLifecycleContext = {
  /** False when the portefeuille cannot yet carry a déclaration. */
  walletReady?: boolean
  /** Accident time. Used only to show the guidance window. */
  createdAt?: string
  now?: number
}

const WALLET_BLOCK: LifecycleBlock = {
  id: 'wallet',
  titleKey: 'lifecycle.block.wallet',
}

function declareWindowBlock(walletReady: boolean): LifecycleBlock {
  return {
    id: 'declareWindow',
    titleKey: walletReady
      ? 'lifecycle.block.declareWindow'
      : 'lifecycle.block.declareWindowWallet',
  }
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
 * NOW pack (sur place): Collecte → Prêt → Clos.
 * Clos = stopped | expired (terminal).
 * A saved pack stays blocked on déclaration while the portefeuille is incomplete.
 */
/** Saved evidence cannot open a déclaration until the portefeuille is complete. */
export function packDeclareBlocked(
  status: EvidencePackStatus,
  walletReady: boolean,
): boolean {
  return status === 'saved' && !walletReady
}

export function packLifecycleStages(
  status: EvidencePackStatus,
  context?: PackLifecycleContext,
): LifecycleStage[] {
  const walletReady = context?.walletReady !== false
  const declareWindowExpired =
    status === 'saved' && isDeclareGuidanceExpired(context?.createdAt, context?.now)
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
          state: declareWindowExpired ? (walletReady ? 'done' : 'cancelled') : 'active',
          tone: walletReady ? 'green' : 'amber',
          block: walletReady ? undefined : WALLET_BLOCK,
        },
        {
          id: 'closed',
          titleKey: 'lifecycle.pack.closed',
          state: declareWindowExpired ? 'active' : 'pending',
          tone: declareWindowExpired ? 'red' : 'gray',
          block: declareWindowExpired ? declareWindowBlock(walletReady) : undefined,
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

export function packLifecycleSegments(
  status: EvidencePackStatus,
  context?: PackLifecycleContext,
): LifecycleSegment[] {
  return packLifecycleStages(status, context).map(segment)
}
