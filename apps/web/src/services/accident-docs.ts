import { jsPDF } from 'jspdf'
import { CONSTAT_MA_CIRCONSTANCES } from '@/domain/constat-ma.ts'
import { displayAccidentRef } from '@/domain/accident-ref'
import type { EvidencePack } from '@/domain/evidence'
import { displayName } from '@/services/wallet.ts'
import type { Wallet } from '@/services/wallet.ts'

function dash(v: string): string {
  const t = v.trim()
  return t || '—'
}

function injuryLabel(pack: EvidencePack): string {
  if (pack.injury === 'yes') return 'Oui / possible'
  if (pack.injury === 'no') return 'Non'
  return '—'
}

function packWhen(pack: EvidencePack): { date: string; time: string } {
  const iso = pack.updatedAt || pack.createdAt
  const d = iso.slice(0, 10)
  const t = iso.length >= 16 ? iso.slice(11, 16) : '—'
  return { date: d || '—', time: t }
}

function drawBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  fill?: [number, number, number],
) {
  if (fill) {
    doc.setFillColor(...fill)
    doc.rect(x, y, w, h, 'FD')
  } else {
    doc.rect(x, y, w, h)
  }
}

function field(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  maxW: number,
): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(60)
  doc.text(label, x, y)
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const lines = doc.splitTextToSize(dash(value), maxW)
  doc.text(lines, x, y + 4)
  const n = Array.isArray(lines) ? lines.length : 1
  return y + 4 + n * 4.2 + 2.5
}

/** Aide-mémoire for authorities — NOT an official PV. */
export function downloadAideMemoirePdf(
  profile: Wallet,
  pack: EvidencePack,
  partLabels: string[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { date, time } = packWhen(pack)
  let y = 16

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('Med Assurance — Fiche faits', 14, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110)
  const disc = doc.splitTextToSize(
    'Aide-mémoire prérempli. Ce n’est PAS un procès-verbal officiel. Seule la police ou la gendarmerie établit le PV.',
    182,
  )
  doc.text(disc, 14, y)
  doc.setTextColor(0)
  y += (Array.isArray(disc) ? disc.length : 1) * 3.8 + 6

  y = field(doc, 'Réf. dossier', displayAccidentRef(pack.ref, pack.id), 14, y, 100)
  y = field(doc, 'Date / heure (indicatif)', `${date}  ${time}`, 14, y, 100)
  y = field(doc, 'Lieu (ville)', pack.city || profile.city, 14, y, 100)
  y = field(doc, 'Blessé(s)', injuryLabel(pack), 14, y, 100)
  y = field(doc, 'Autre conducteur', pack.otherDriver ?? '—', 14, y, 100)
  y += 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Vous', 14, y)
  y += 5
  y = field(doc, 'Nom', displayName(profile), 14, y, 170)
  y = field(doc, 'Tél. / CIN / permis', `${profile.phone} · ${profile.cin} · ${profile.licenseNumber}`, 14, y, 170)
  y = field(doc, 'Véhicule / plaque', `${profile.vehicle} · ${profile.plate}`, 14, y, 170)
  y = field(doc, 'Assureur / contrat', `${profile.insurer} · ${profile.policy}`, 14, y, 170)
  y += 2

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Autre partie', 14, y)
  y += 5
  y = field(doc, 'Nom', pack.constat.otherName, 14, y, 170)
  y = field(doc, 'Plaque / tél. / assureur', `${pack.constat.otherPlate} · ${pack.constat.otherPhone} · ${pack.constat.otherInsurer}`, 14, y, 170)
  y = field(doc, 'Zones endommagées', partLabels.length ? partLabels.join(', ') : '—', 14, y, 170)
  y = field(doc, 'Faits (sans faute)', pack.constat.notes, 14, y, 170)

  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Remettez cette fiche aux autorités si utile. Conservez une copie.', 14, Math.min(y + 6, 285))
  doc.save(`med-assurance-fiche-autorites-${(pack.ref || pack.id).replace(/#/g, '')}.pdf`)
}

/**
 * Draft aligned to Moroccan constat amiable layout
 * (`docs/assets/constat-a-lamiable-maroc-template.pdf`). NOT a signed form.
 */
export function downloadConstatDraftPdf(
  profile: Wallet,
  pack: EvidencePack,
  partLabels: string[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 10
  const { date, time } = packWhen(pack)
  let y = 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('CONSTAT AMIABLE D’ACCIDENT AUTOMOBILE', pageW / 2, y, { align: 'center' })
  y += 5
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Brouillon Med Assurance — à recopier sur le formulaire papier / e-constat', pageW / 2, y, {
    align: 'center',
  })
  doc.setTextColor(0)
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(120)
  const disc = doc.splitTextToSize(
    'Pas un formulaire officiel signé. Vérifiez chaque case sur le constat papier (FR/AR), puis signez avec l’autre conducteur. Ne pas modifier après séparation des feuillets.',
    pageW - margin * 2,
  )
  doc.text(disc, margin, y)
  doc.setTextColor(0)
  y += (Array.isArray(disc) ? disc.length : 1) * 3.2 + 4

  // Common header strip
  drawBox(doc, margin, y, pageW - margin * 2, 18)
  const hx = margin + 2
  let hy = y + 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('1. Date', hx, hy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(dash(date), hx + 16, hy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('2. Heure', hx + 55, hy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(dash(time), hx + 72, hy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('Réf.', hx + 110, hy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text(displayAccidentRef(pack.ref, pack.id), hx + 122, hy)
  hy += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('3. Lieu', hx, hy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(dash(pack.city || profile.city), hx + 16, hy)
  hy += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('4. Blessé(s) même léger(s)', hx, hy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(injuryLabel(pack), hx + 42, hy)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('5. Dégâts hors A/B', hx + 90, hy)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('□ Oui   □ Non', hx + 122, hy)
  y += 20

  // A / B columns
  const gap = 3
  const colW = (pageW - margin * 2 - gap) / 2
  const colA = margin
  const colB = margin + colW + gap
  const colTop = y

  drawBox(doc, colA, colTop, colW, 78, [255, 248, 220])
  drawBox(doc, colB, colTop, colW, 78, [232, 245, 233])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Véhicule A — Vous', colA + 2, colTop + 5)
  doc.text('Véhicule B — Autre', colB + 2, colTop + 5)

  let ya = colTop + 9
  ya = field(doc, 'Assuré (nom)', displayName(profile), colA + 2, ya, colW - 6)
  ya = field(doc, 'Adresse / ville', profile.city, colA + 2, ya, colW - 6)
  ya = field(doc, 'Véhicule', profile.vehicle, colA + 2, ya, colW - 6)
  ya = field(doc, 'Immatriculation', profile.plate, colA + 2, ya, colW - 6)
  ya = field(doc, 'Assurance / contrat', `${profile.insurer} · ${profile.policy}`, colA + 2, ya, colW - 6)
  ya = field(doc, 'Attestation valable jusqu’au', profile.attestationValidUntil, colA + 2, ya, colW - 6)
  ya = field(doc, 'Permis', profile.licenseNumber, colA + 2, ya, colW - 6)
  ya = field(
    doc,
    'Dégâts apparents / point de choc',
    partLabels.length ? partLabels.join(', ') : '',
    colA + 2,
    ya,
    colW - 6,
  )
  field(doc, 'Observations', pack.constat.notes, colA + 2, ya, colW - 6)

  let yb = colTop + 9
  yb = field(doc, 'Nom / conducteur', pack.constat.otherName, colB + 2, yb, colW - 6)
  yb = field(doc, 'Immatriculation', pack.constat.otherPlate, colB + 2, yb, colW - 6)
  yb = field(doc, 'Téléphone', pack.constat.otherPhone, colB + 2, yb, colW - 6)
  yb = field(doc, 'Assurance', pack.constat.otherInsurer, colB + 2, yb, colW - 6)
  yb = field(doc, 'N° de contrat', '', colB + 2, yb, colW - 6)
  yb = field(doc, 'Permis', '', colB + 2, yb, colW - 6)
  yb = field(doc, 'Dégâts apparents / point de choc', '', colB + 2, yb, colW - 6)
  field(doc, 'Observations', '', colB + 2, yb, colW - 6)

  y = colTop + 80

  // Circonstances
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('12. Circonstances — cocher sur le papier (A à gauche, B à droite)', margin, y)
  y += 3
  const circH = 52
  drawBox(doc, margin, y, pageW - margin * 2, circH)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  let cy = y + 3.5
  const mid = pageW / 2
  for (let i = 0; i < CONSTAT_MA_CIRCONSTANCES.length; i++) {
    const n = i + 1
    const label = `${n}. ${CONSTAT_MA_CIRCONSTANCES[i]}`
    const row = i < 9 ? i : i - 9
    const x = i < 9 ? margin + 2 : mid + 2
    const yy = cy + row * 5.2
    doc.text(`□A  □B  ${label}`, x, yy, { maxWidth: mid - margin - 6 })
  }
  y += circH + 3
  doc.setFontSize(7)
  doc.text('Nombre de cases cochées — A : ____    B : ____', margin, y)
  y += 5

  // Croquis
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('13. Croquis de l’accident (à dessiner sur le papier)', margin, y)
  y += 2
  const croquisH = 28
  drawBox(doc, margin, y, pageW - margin * 2, croquisH)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(140)
  doc.text(
    'Voies · direction A/B · position au choc · signalisation · noms des rues',
    margin + 3,
    y + 5,
  )
  doc.setTextColor(0)
  y += croquisH + 5

  // Signatures
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('15. Signatures (obligatoires sur le formulaire officiel)', margin, y)
  y += 3
  drawBox(doc, margin, y, colW, 16)
  drawBox(doc, colB, y, colW, 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Conducteur A', margin + 2, y + 4)
  doc.text('Conducteur B', colB + 2, y + 4)
  y += 20

  doc.setFontSize(7)
  doc.setTextColor(100)
  doc.text(
    'Docs vérifiés (permis / attestation) : ' +
      (pack.constat.attestedDocsChecked ? 'oui' : 'non / à faire sur place'),
    margin,
    y,
  )
  y += 4
  doc.text(
    'Référence papier : docs/assets/constat-a-lamiable-maroc-template.pdf',
    margin,
    y,
  )

  doc.save(`med-assurance-constat-brouillon-${(pack.ref || pack.id).replace(/#/g, '')}.pdf`)
}
