/** Motor-relevant Moroccan insurers (ACAPS-supervised composite / non-life). */
export const MOROCCAN_INSURERS = [
  'Allianz Maroc',
  'AtlantaSanad',
  'AXA Assurance Maroc',
  'CAT Assurance et Réassurance',
  'MAMDA',
  'MATU',
  'MCMA',
  'RMA',
  'Sanlam Maroc',
  'Wafa Assurance',
] as const

export type MoroccanInsurer = (typeof MOROCCAN_INSURERS)[number]

export function isMoroccanInsurer(value: string): value is MoroccanInsurer {
  return (MOROCCAN_INSURERS as readonly string[]).includes(value)
}
