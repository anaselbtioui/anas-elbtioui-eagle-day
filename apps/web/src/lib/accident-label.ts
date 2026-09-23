import { displayAccidentRef } from '@/domain/accident-ref'
import type { CarPart, EvidencePack } from '@/domain/evidence'

export type AccidentLabelCopy = {
  draft: string
  injury: string
  injuryUnknown: string
  material: string
  alone: string
  fled: string
  refuses: string
  immobilised: string
  part: (id: CarPart) => string
  damageExtra: (n: number) => string
}

/** Build a scannable French label from NOW wizard facts (+ city snapshot). */
export function accidentDisplayTitle(
  pack: Pick<
    EvidencePack,
    | 'id'
    | 'ref'
    | 'city'
    | 'injury'
    | 'otherDriver'
    | 'constat'
    | 'damagedParts'
    | 'driveable'
  >,
  copy: AccidentLabelCopy,
): string {
  const bits: string[] = []

  const city = pack.city?.trim()
  if (city) bits.push(city)

  if (pack.injury === 'yes') bits.push(copy.injury)
  else if (pack.injury === 'unknown') bits.push(copy.injuryUnknown)
  else if (pack.injury === 'no') bits.push(copy.material)
  else bits.push(copy.draft)

  const plate = pack.constat.otherPlate.trim()
  const name = pack.constat.otherName.trim()
  if (plate) bits.push(plate)
  else if (name) bits.push(name)
  else if (pack.otherDriver === 'alone') bits.push(copy.alone)
  else if (pack.otherDriver === 'fled') bits.push(copy.fled)
  else if (pack.otherDriver === 'refuses') bits.push(copy.refuses)
  else if (pack.damagedParts.length > 0) {
    const [first, ...rest] = pack.damagedParts
    bits.push(copy.part(first!))
    if (rest.length > 0) bits.push(copy.damageExtra(rest.length))
  }

  if (pack.driveable === false) bits.push(copy.immobilised)

  if (bits.length <= 1) {
    return displayAccidentRef(pack.ref, pack.id)
  }
  return bits.join(' · ')
}

export function accidentLabelCopyFromT(
  t: (key: string, opts?: Record<string, unknown>) => string,
): AccidentLabelCopy {
  return {
    draft: t('motorist.labelDraft'),
    injury: t('motorist.labelInjury'),
    injuryUnknown: t('motorist.labelInjuryUnknown'),
    material: t('motorist.labelMaterial'),
    alone: t('motorist.labelAlone'),
    fled: t('motorist.labelFled'),
    refuses: t('motorist.labelRefuses'),
    immobilised: t('motorist.labelImmobilised'),
    part: (id) => t(`now.part_${id}`),
    damageExtra: (n) => t('motorist.labelDamageExtra', { n }),
  }
}
