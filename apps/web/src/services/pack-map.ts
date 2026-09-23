import type {
  EvidencePack as DomainPack,
  OtherPartyStatus,
  PhotoSlot,
} from '@/domain/types.ts'
import { accidentRefFromId } from '@/domain/accident-ref'
import {
  CAR_PARTS,
  createEmptyPack,
  type CarPart,
  type EvidencePack as UiPack,
  type OtherDriverAnswer,
  type PhotoSlotId,
} from '@/domain/evidence'

export function toDomainPack(
  ui: UiPack,
  ctx: { motoristId: string; policyId: string | null; city: string | null },
): DomainPack {
  const otherParty = otherPartyFromUi(ui)
  return {
    incident: {
      id: ui.id,
      ref: ui.ref || accidentRefFromId(ui.id),
      motoristId: ctx.motoristId,
      policyId: ctx.policyId,
      occurredAt: ui.createdAt,
      city: ui.city ?? ctx.city,
      injury: ui.injury ?? 'no',
      vehicleImmobilised: ui.driveable === false,
      otherPartyId: otherParty?.id ?? null,
      workCommute: null,
      archivedAt: ui.archivedAt,
    },
    otherParty,
    evidence: {
      incidentId: ui.id,
      constat: ui.constat.attestedDocsChecked
        ? 'complete'
        : ui.constat.otherName || ui.constat.notes || ui.constat.otherPlate
          ? 'started'
          : 'absent',
      pv: ui.stopReason ? 'required' : 'not_needed',
      damageZones: ui.damagedParts.map((id) => ({ id, label: id })),
      photos: Object.entries(ui.photos)
        .filter(([, dataUrl]) => Boolean(dataUrl))
        .map(([slot]) => ({
          photoId: `${ui.id}:${slot}`,
          slot: toDomainSlot(slot as PhotoSlotId),
          zoneId: isCarPart(slot) ? slot : null,
          label: slot,
          capturedAt: ui.updatedAt,
          storagePath: null,
        })),
    },
  }
}

export function fromDomainPack(pack: DomainPack): UiPack {
  const base = createEmptyPack()
  const damagedParts = pack.evidence.damageZones
    .map((z) => z.id)
    .filter((id): id is CarPart => isCarPart(id))
  return {
    ...base,
    id: pack.incident.id,
    ref: pack.incident.ref || accidentRefFromId(pack.incident.id),
    createdAt: pack.incident.occurredAt ?? base.createdAt,
    updatedAt: pack.incident.occurredAt ?? base.updatedAt,
    city: pack.incident.city,
    status: pack.evidence.pv === 'required' ? 'stopped' : 'saved',
    injury: pack.incident.injury,
    otherDriver: otherDriverFromDomain(pack),
    constat: {
      otherName: pack.otherParty?.name ?? '',
      otherPlate: pack.otherParty?.plate ?? '',
      otherPhone: '',
      otherInsurer: '',
      notes: '',
      attestedDocsChecked: pack.evidence.constat === 'complete',
    },
    damagedParts,
    photos: {},
    driveable: pack.incident.vehicleImmobilised ? false : true,
    assistanceShown: pack.incident.vehicleImmobilised,
    stopReason:
      pack.incident.injury === 'yes' || pack.incident.injury === 'unknown'
        ? 'injury'
        : pack.evidence.pv === 'required'
          ? 'other'
          : pack.otherParty && pack.otherParty.status !== 'known'
            ? 'other'
            : null,
    archivedAt: pack.incident.archivedAt ?? null,
  }
}

export function packLooksStarted(pack: DomainPack): boolean {
  return (
    pack.incident.injury !== 'no' ||
    pack.incident.vehicleImmobilised ||
    pack.evidence.constat !== 'absent' ||
    pack.evidence.photos.length > 0 ||
    pack.otherParty !== null ||
    pack.evidence.pv === 'required'
  )
}

function otherPartyFromUi(ui: UiPack) {
  const status = otherStatusFromUi(ui.otherDriver)
  if (!status) return null
  return {
    id: `${ui.id}-O`,
    status,
    name: ui.constat.otherName.trim() || null,
    plate: ui.constat.otherPlate.trim() || null,
  }
}

function otherStatusFromUi(other: OtherDriverAnswer | null): OtherPartyStatus | null {
  if (!other || other === 'alone') return null
  if (other === 'cooperates') return 'known'
  if (other === 'refuses') return 'refused'
  if (other === 'fled') return 'fled'
  return 'unknown'
}

function otherDriverFromDomain(pack: DomainPack): OtherDriverAnswer | null {
  if (!pack.otherParty) return pack.incident.injury === 'no' ? 'alone' : null
  switch (pack.otherParty.status) {
    case 'known':
      return 'cooperates'
    case 'refused':
      return 'refuses'
    case 'fled':
      return 'fled'
    default:
      return 'unknown'
  }
}

function toDomainSlot(slot: PhotoSlotId): PhotoSlot {
  if (slot === 'scene') return 'scene'
  if (slot.startsWith('corner')) return 'corner'
  if (isCarPart(slot)) return 'part'
  return 'other'
}

function isCarPart(id: string): id is CarPart {
  return (CAR_PARTS as string[]).includes(id)
}

export { toDomainSlot }
