import { jsPDF } from 'jspdf'
import type { EvidencePack } from '@/domain/evidence'
import type { Wallet } from '@/services/wallet.ts'

function dash(v: string): string {
  const t = v.trim()
  return t || '—'
}

function line(doc: jsPDF, label: string, value: string, x: number, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(label, x, y)
  doc.setFont('helvetica', 'normal')
  const wrapped = doc.splitTextToSize(dash(value), 170)
  doc.text(wrapped, x + 52, y)
  const h = Array.isArray(wrapped) ? wrapped.length * 5 : 5
  return y + Math.max(7, h + 2)
}

function addHeader(doc: jsPDF, title: string, disclaimer: string): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('Med Assurance', 20, 18)
  doc.setFontSize(12)
  doc.text(title, 20, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  const disc = doc.splitTextToSize(disclaimer, 170)
  doc.text(disc, 20, 36)
  doc.setTextColor(0)
  const discH = Array.isArray(disc) ? disc.length * 4 : 4
  return 40 + discH
}

function addYouBlock(doc: jsPDF, profile: Wallet, y0: number): number {
  let y = y0
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('A — Votre véhicule', 20, y)
  y += 8
  y = line(doc, 'Nom', profile.name, 20, y)
  y = line(doc, 'Tél.', profile.phone, 20, y)
  y = line(doc, 'CIN', profile.cin, 20, y)
  y = line(doc, 'Permis', profile.licenseNumber, 20, y)
  y = line(doc, 'Plaque', profile.plate, 20, y)
  y = line(doc, 'Véhicule', profile.vehicle, 20, y)
  y = line(doc, 'Assureur', profile.insurer, 20, y)
  y = line(doc, 'Police', profile.policy, 20, y)
  y = line(doc, 'Ville', profile.city, 20, y)
  return y + 4
}

function addOtherBlock(doc: jsPDF, pack: EvidencePack, y0: number): number {
  let y = y0
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('B — Autre véhicule / conducteur', 20, y)
  y += 8
  y = line(doc, 'Nom', pack.constat.otherName, 20, y)
  y = line(doc, 'Plaque', pack.constat.otherPlate, 20, y)
  y = line(doc, 'Tél.', pack.constat.otherPhone, 20, y)
  y = line(doc, 'Assureur', pack.constat.otherInsurer, 20, y)
  return y + 4
}

function addFactsBlock(
  doc: jsPDF,
  pack: EvidencePack,
  y0: number,
  partLabels: string[],
): number {
  let y = y0
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('C — Faits & dégâts', 20, y)
  y += 8
  y = line(doc, 'Pack', pack.id, 20, y)
  y = line(doc, 'Date', pack.updatedAt.slice(0, 16).replace('T', ' '), 20, y)
  y = line(
    doc,
    'Blessure',
    pack.injury === 'yes' ? 'Oui / possible' : pack.injury === 'no' ? 'Non signalée' : 'Inconnue',
    20,
    y,
  )
  y = line(
    doc,
    'Autre',
    pack.otherDriver ?? '—',
    20,
    y,
  )
  y = line(doc, 'Zones', partLabels.length ? partLabels.join(', ') : '—', 20, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Faits (sans faute)', 20, y)
  y += 5
  doc.setFont('helvetica', 'normal')
  const notes = doc.splitTextToSize(dash(pack.constat.notes), 170)
  doc.text(notes, 20, y)
  y += (Array.isArray(notes) ? notes.length : 1) * 5 + 6
  return y
}

function savePdf(doc: jsPDF, filename: string) {
  doc.save(filename)
}

/** Aide-mémoire for authorities — NOT an official PV. */
export function downloadAideMemoirePdf(
  profile: Wallet,
  pack: EvidencePack,
  partLabels: string[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = addHeader(
    doc,
    'Fiche faits pour les autorités',
    'Ce document est un aide-mémoire prérempli par Med Assurance. Ce n’est PAS un procès-verbal officiel. Seule la police ou la gendarmerie établit le PV.',
  )
  y = addYouBlock(doc, profile, y)
  y = addOtherBlock(doc, pack, y)
  y = addFactsBlock(doc, pack, y, partLabels)
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Remettez cette fiche aux autorités si utile. Conservez une copie.', 20, Math.min(y + 4, 280))
  savePdf(doc, `med-assurance-fiche-autorites-${pack.id.slice(0, 12)}.pdf`)
}

/** Draft constat amiable layout — NOT a signed official form. */
export function downloadConstatDraftPdf(
  profile: Wallet,
  pack: EvidencePack,
  partLabels: string[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = addHeader(
    doc,
    'Brouillon — constat amiable',
    'Brouillon prérempli pour vous aider. Ce n’est PAS le formulaire officiel signé. Recopiez / vérifiez sur le constat papier (ou e-constat), puis signez avec l’autre conducteur.',
  )
  y = addYouBlock(doc, profile, y)
  y = addOtherBlock(doc, pack, y)
  y = addFactsBlock(doc, pack, y, partLabels)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Cases / croquis', 20, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('À compléter sur le constat papier : croquis, cases cochées, signatures.', 20, y)
  y += 10
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text(
    'Docs vérifiés (permis / attestation) : ' +
      (pack.constat.attestedDocsChecked ? 'oui' : 'non / à faire'),
    20,
    y,
  )
  savePdf(doc, `med-assurance-constat-brouillon-${pack.id.slice(0, 12)}.pdf`)
}
