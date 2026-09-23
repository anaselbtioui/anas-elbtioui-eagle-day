/**
 * Field map for the Moroccan « Constat amiable d'accident automobile »
 * (FR/AR paper form). Reference scan: `docs/assets/constat-a-lamiable-maroc-template.pdf`.
 *
 * Med Assurance drafts prefill these slots; they are NOT a signed official form.
 * Paper variants may list 17 or ~23 circonstances — we use the standard 17
 * (same wording as FMA / European accident statement used in Morocco).
 */

export type ConstatMaSectionId =
  | 'header'
  | 'common'
  | 'vehicle_a'
  | 'vehicle_b'
  | 'circonstances'
  | 'croquis'
  | 'signatures'

export type ConstatMaField = {
  id: string
  section: ConstatMaSectionId
  /** Label on the paper form (FR). */
  label: string
  /** Where Med Assurance can prefill today. */
  source: 'wallet' | 'pack' | 'manual' | 'none'
}

/** Ordered field map aligning draft PDF ↔ paper form. */
export const CONSTAT_MA_FIELDS: readonly ConstatMaField[] = [
  { id: 'date', section: 'common', label: 'Date de l’accident', source: 'pack' },
  { id: 'time', section: 'common', label: 'Heure', source: 'pack' },
  { id: 'lieu', section: 'common', label: 'Lieu précis', source: 'pack' },
  { id: 'blesses', section: 'common', label: 'Blessé(s) même léger(s)', source: 'pack' },
  {
    id: 'degats_autres',
    section: 'common',
    label: 'Dégâts matériels autres qu’aux véhicules A et B',
    source: 'manual',
  },
  { id: 'temoins', section: 'common', label: 'Témoins (noms, adresses)', source: 'manual' },

  { id: 'a_assure_nom', section: 'vehicle_a', label: 'Assuré — nom / prénom', source: 'wallet' },
  { id: 'a_assure_adresse', section: 'vehicle_a', label: 'Assuré — adresse / ville', source: 'wallet' },
  { id: 'a_vehicule', section: 'vehicle_a', label: 'Véhicule — marque / type', source: 'wallet' },
  { id: 'a_immat', section: 'vehicle_a', label: 'N° d’immatriculation', source: 'wallet' },
  { id: 'a_assureur', section: 'vehicle_a', label: 'Société d’assurance', source: 'wallet' },
  { id: 'a_police', section: 'vehicle_a', label: 'N° de contrat / police', source: 'wallet' },
  { id: 'a_validite', section: 'vehicle_a', label: 'Attestation — validité', source: 'wallet' },
  { id: 'a_conducteur', section: 'vehicle_a', label: 'Conducteur — nom / prénom', source: 'wallet' },
  { id: 'a_permis', section: 'vehicle_a', label: 'N° de permis', source: 'wallet' },
  { id: 'a_choc', section: 'vehicle_a', label: 'Point de choc initial', source: 'pack' },
  { id: 'a_degats', section: 'vehicle_a', label: 'Dégâts apparents', source: 'pack' },
  { id: 'a_observations', section: 'vehicle_a', label: 'Observations', source: 'pack' },

  { id: 'b_assure_nom', section: 'vehicle_b', label: 'Assuré / conducteur — nom', source: 'pack' },
  { id: 'b_immat', section: 'vehicle_b', label: 'N° d’immatriculation', source: 'pack' },
  { id: 'b_tel', section: 'vehicle_b', label: 'Téléphone', source: 'pack' },
  { id: 'b_assureur', section: 'vehicle_b', label: 'Société d’assurance', source: 'pack' },
  { id: 'b_police', section: 'vehicle_b', label: 'N° de contrat / police', source: 'manual' },
  { id: 'b_permis', section: 'vehicle_b', label: 'N° de permis', source: 'manual' },
  { id: 'b_choc', section: 'vehicle_b', label: 'Point de choc initial', source: 'manual' },
  { id: 'b_degats', section: 'vehicle_b', label: 'Dégâts apparents', source: 'manual' },
  { id: 'b_observations', section: 'vehicle_b', label: 'Observations', source: 'manual' },

  { id: 'circonstances', section: 'circonstances', label: 'Cases 1–17 (par véhicule)', source: 'manual' },
  { id: 'croquis', section: 'croquis', label: 'Croquis de l’accident', source: 'manual' },
  { id: 'sig_a', section: 'signatures', label: 'Signature conducteur A', source: 'none' },
  { id: 'sig_b', section: 'signatures', label: 'Signature conducteur B', source: 'none' },
] as const

/** Standard 17 circonstances (EU / MA paper form). */
export const CONSTAT_MA_CIRCONSTANCES: readonly string[] = [
  'En stationnement / à l’arrêt',
  'Quittait un stationnement / ouvrait une portière',
  'Prenait un stationnement',
  'Sortait d’un parking, d’un lieu privé, d’un chemin de terre',
  'S’engageait dans un parking, un lieu privé, un chemin de terre',
  'S’engageait sur un rond-point',
  'Roulait sur un rond-point',
  'Heurtait l’arrière de l’autre véhicule (même sens, même file)',
  'Roulait dans le même sens sur une file différente',
  'Changeait de file',
  'Doublait',
  'Virait à droite',
  'Virait à gauche',
  'Reculait',
  'Empiétait sur la voie en sens inverse',
  'Venait de droite (dans un carrefour)',
  'N’avait pas respecté un signal de priorité ou un feu rouge',
] as const
