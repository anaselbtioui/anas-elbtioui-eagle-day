import type { Contact, EvidencePack, Profile } from './types.ts'
import { accidentRefFromId } from './accident-ref.ts'
import { emptyEvidence } from './rules.ts'

export const contacts: Contact[] = [
  {
    id: 'C-POLICE',
    role: 'authorities',
    displayName: 'Police / gendarmerie',
    phone: '19',
    url: null,
    note: 'Urgence et procès-verbal. Pas un assureur.',
  },
  {
    id: 'C-ASSIST',
    role: 'assistance',
    displayName: 'Assistance (exemple contrat)',
    phone: '3434',
    url: 'https://sanlam.ma/fr/sinistres/accident-de-voiture/',
    note: 'Assistance 24 h/24 si le contrat le prévoit. Pas l’assureur, pas un secours d’État.',
  },
  {
    id: 'C-INS',
    role: 'insurer_general',
    displayName: 'Relation client assureur (exemple)',
    phone: '2526',
    url: null,
    note: 'Ligne générale. Pas un service d’urgence.',
  },
  {
    id: 'C-BROKER',
    role: 'broker',
    displayName: 'Courtier (stub)',
    phone: '+212 5 22 27 03 43',
    url: null,
    note: 'Canal de la déclaration. Ne décide pas la garantie.',
  },
]

export const nadiaProfile: Profile = {
  motorist: {
    id: 'M-1',
    name: 'Nadia El Mansouri',
    phone: '06•••••142',
    alsoTellEmployerIfCommute: false,
  },
  vehicle: {
    id: 'V-1',
    plate: '12345-A-50',
    makeModel: 'Dacia Sandero · 2022',
  },
  insurer: { id: 'I-1', displayName: 'Assureur (stub)' },
  broker: { id: 'B-1', displayName: 'Courtier (stub)' },
  policy: {
    id: 'P-1',
    number: 'MA-AUTO-24018',
    insurerId: 'I-1',
    brokerId: 'B-1',
    vehicleId: 'V-1',
    assistanceOnContract: 'unknown',
  },
}

export function nadiaMissingConstatPack(): EvidencePack {
  return {
    incident: {
      id: 'INC-1',
      ref: accidentRefFromId('INC-1'),
      motoristId: 'M-1',
      policyId: 'P-1',
      occurredAt: '2026-09-18T16:00:00.000Z',
      city: 'Casablanca',
      injury: 'no',
      vehicleImmobilised: false,
      otherPartyId: 'O-1',
      workCommute: false,
    },
    otherParty: {
      id: 'O-1',
      status: 'known',
      name: 'Autre conducteur (démo)',
      plate: null,
    },
    evidence: {
      incidentId: 'INC-1',
      constat: 'absent',
      pv: 'not_needed',
      damageZones: [],
      photos: [],
    },
  }
}

export function saraInjuryPack(): EvidencePack {
  return {
    incident: {
      id: 'INC-2',
      ref: accidentRefFromId('INC-2'),
      motoristId: 'M-2',
      policyId: null,
      occurredAt: '2026-09-19T07:55:00.000Z',
      city: 'Marrakech',
      injury: 'yes',
      vehicleImmobilised: false,
      otherPartyId: null,
      workCommute: null,
    },
    otherParty: null,
    evidence: {
      ...emptyEvidence('INC-2'),
      pv: 'required',
    },
  }
}

export const saraMotorist = {
  id: 'M-2',
  name: 'Sara Amrani',
  phone: '06•••••881',
  alsoTellEmployerIfCommute: false,
}

export const omarProfile: Profile = {
  motorist: {
    id: 'M-3',
    name: 'Omar Benali',
    phone: '06•••••604',
    alsoTellEmployerIfCommute: false,
  },
  vehicle: {
    id: 'V-3',
    plate: '67890-B-16',
    makeModel: 'Renault Clio · 2021',
  },
  insurer: { id: 'I-1', displayName: 'Assureur (stub)' },
  broker: { id: 'B-1', displayName: 'Courtier (stub)' },
  policy: {
    id: 'P-3',
    number: 'MA-AUTO-23872',
    insurerId: 'I-1',
    brokerId: 'B-1',
    vehicleId: 'V-3',
    assistanceOnContract: 'unknown',
  },
}

export function omarImmobilisedPack(): EvidencePack {
  return {
    incident: {
      id: 'INC-3',
      ref: accidentRefFromId('INC-3'),
      motoristId: 'M-3',
      policyId: 'P-3',
      occurredAt: '2026-09-19T08:12:00.000Z',
      city: 'Rabat',
      injury: 'no',
      vehicleImmobilised: true,
      otherPartyId: null,
      workCommute: false,
    },
    otherParty: null,
    evidence: {
      incidentId: 'INC-3',
      constat: 'started',
      pv: 'not_needed',
      damageZones: [],
      photos: [],
    },
  }
}

export const saraProfile: Profile = {
  motorist: saraMotorist,
  vehicle: {
    id: 'V-2',
    plate: '33441-C-71',
    makeModel: 'Peugeot 208 · 2023',
  },
  insurer: { id: 'I-1', displayName: 'Assureur (stub)' },
  broker: { id: 'B-1', displayName: 'Courtier (stub)' },
  policy: {
    id: 'P-2',
    number: 'MA-AUTO-24191',
    insurerId: 'I-1',
    brokerId: 'B-1',
    vehicleId: 'V-2',
    assistanceOnContract: 'yes',
  },
}
