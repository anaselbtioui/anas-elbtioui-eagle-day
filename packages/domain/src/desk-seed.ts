import {
  nadiaMissingConstatPack,
  nadiaProfile,
  omarImmobilisedPack,
  omarProfile,
  saraInjuryPack,
  saraProfile,
} from './fixtures.ts'
import type { DeskBundle } from './desk.ts'
import { ACAPS_NOTIFY_GUIDANCE } from './types.ts'

export function seedDeskBundles(): DeskBundle[] {
  const nadiaPack = nadiaMissingConstatPack()
  const omarPack = omarImmobilisedPack()
  const saraPack = saraInjuryPack()

  const nadia: DeskBundle = {
    dossierId: 'DOS-1',
    title: 'Collision légère · Casablanca',
    profile: nadiaProfile,
    pack: nadiaPack,
    declaration: {
      id: 'DEC-1',
      incidentId: 'INC-1',
      narrative: 'Collision légère au rond-point. Constat non signé.',
      documentRefs: [{ kind: 'constat', label: 'Constat', present: false }],
      channel: 'broker',
      submittedAt: null,
    },
    dossier: {
      id: 'DOS-1',
      declarationId: 'DEC-1',
      missingPieces: ['constat_or_pv', 'photos'],
      status: 'blocked_missing_evidence',
      nextHumanStep:
        'Obtenir le constat signé (ou un PV) avant d’envoyer la déclaration.',
      notifiedWithinGuidanceNote: ACAPS_NOTIFY_GUIDANCE,
      closedAt: null,
      closedReason: null,
    },
    provenance: {
      source: 'CRM broker',
      freshness: '2026-09-19T08:40:00.000Z',
      owner: 'Salma',
    },
    tasks: [
      { id: 'T-N1', label: 'Obtenir le constat signé', done: false },
      {
        id: 'T-N2',
        label: 'Vérifier les coordonnées de l’autre conducteur',
        done: false,
      },
    ],
    requests: [],
    drafts: [],
    events: [
      {
        id: 'EVT-N1',
        at: '2026-09-19T08:40:00.000Z',
        actor: 'system',
        label: 'Dossier ouvert — constat manquant',
        motoristVisible: true,
      },
    ],
    motoristAccountDeleted: false,
  }

  const omar: DeskBundle = {
    dossierId: 'DOS-3',
    title: 'Véhicule immobilisé · Rabat',
    profile: omarProfile,
    pack: omarPack,
    declaration: {
      id: 'DEC-3',
      incidentId: 'INC-3',
      narrative: 'Véhicule immobilisé. Assistance du contrat à vérifier.',
      documentRefs: [{ kind: 'other', label: 'N° assistance', present: false }],
      channel: 'broker',
      submittedAt: null,
    },
    dossier: {
      id: 'DOS-3',
      declarationId: 'DEC-3',
      missingPieces: ['other', 'photos'],
      status: 'with_broker',
      nextHumanStep:
        'Vérifier le numéro d’assistance sur le contrat avec le client. Ce n’est pas une décision de garantie.',
      notifiedWithinGuidanceNote: ACAPS_NOTIFY_GUIDANCE,
      closedAt: null,
      closedReason: null,
    },
    provenance: {
      source: 'Import navigateur simulé',
      freshness: '2026-09-19T08:12:00.000Z',
      owner: 'Youssef',
    },
    tasks: [
      {
        id: 'T-O1',
        label: 'Vérifier le n° d’assistance (contrat)',
        done: false,
      },
      { id: 'T-O2', label: 'Proposer un rappel humain', done: false },
    ],
    requests: [],
    drafts: [],
    events: [
      {
        id: 'EVT-O1',
        at: '2026-09-19T08:12:00.000Z',
        actor: 'system',
        label: 'Véhicule immobilisé — assistance à vérifier',
        motoristVisible: true,
      },
    ],
    motoristAccountDeleted: false,
  }

  const sara: DeskBundle = {
    dossierId: 'DOS-2',
    title: 'Accident avec blessure · Marrakech',
    profile: saraProfile,
    pack: saraPack,
    declaration: null,
    dossier: {
      id: 'DOS-2',
      declarationId: 'DEC-2-PENDING',
      missingPieces: ['constat_or_pv'],
      status: 'blocked_missing_evidence',
      nextHumanStep:
        'Blessure signalée : obtenir le PV / confirmer la prise en charge humaine. Pas de déclaration tant que le PV n’est pas obtenu.',
      notifiedWithinGuidanceNote: ACAPS_NOTIFY_GUIDANCE,
      closedAt: null,
      closedReason: null,
    },
    provenance: {
      source: 'Formulaire local',
      freshness: '2026-09-19T07:55:00.000Z',
      owner: 'Imane',
    },
    tasks: [
      {
        id: 'T-S1',
        label: 'Confirmer la prise en charge humaine immédiate',
        done: false,
      },
    ],
    requests: [],
    drafts: [],
    events: [
      {
        id: 'EVT-S1',
        at: '2026-09-19T07:55:00.000Z',
        actor: 'system',
        label: 'Blessure signalée — PV requis',
        motoristVisible: true,
      },
    ],
    motoristAccountDeleted: false,
  }

  return [nadia, omar, sara]
}
