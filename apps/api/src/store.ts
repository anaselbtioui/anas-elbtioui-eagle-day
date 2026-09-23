import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  Broker,
  Contact,
  Declaration,
  Dossier,
  Evidence,
  Incident,
  Insurer,
  Motorist,
  OtherParty,
  Policy,
  Vehicle,
} from '@labas/domain/types.ts'
import type { AppUserRecord } from '@labas/domain/auth.ts'
import { contacts, nadiaProfile } from '@labas/domain/fixtures.ts'
import { emptyDeskFiles, type DeskFile } from './desk.ts'

export type Db = {
  motorists: Motorist[]
  vehicles: Vehicle[]
  insurers: Insurer[]
  brokers: Broker[]
  policies: Policy[]
  otherParties: OtherParty[]
  incidents: Incident[]
  evidences: Evidence[]
  declarations: Declaration[]
  dossiers: Dossier[]
  contacts: Contact[]
  deskFiles: DeskFile[]
  users: AppUserRecord[]
}

const dir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(dir, 'data')
const dbPath = path.join(dataDir, 'db.json')

export function emptyDb(): Db {
  const p = nadiaProfile
  return {
    motorists: [p.motorist],
    vehicles: [p.vehicle],
    insurers: [p.insurer],
    brokers: [p.broker],
    policies: [p.policy],
    otherParties: [],
    incidents: [],
    evidences: [],
    declarations: [],
    dossiers: [],
    contacts: [...contacts],
    deskFiles: emptyDeskFiles(),
    users: [],
  }
}

export async function loadDb(): Promise<Db> {
  try {
    const raw = await readFile(dbPath, 'utf8')
    const parsed = JSON.parse(raw) as Db
    return {
      ...emptyDb(),
      ...parsed,
      motorists: (parsed.motorists ?? emptyDb().motorists).map((m) => ({
        ...m,
        cin: m.cin ?? null,
        city: m.city ?? null,
        licenseNumber: m.licenseNumber ?? null,
        licensePhotoPath: m.licensePhotoPath ?? null,
        carteGrisePhotoPath: m.carteGrisePhotoPath ?? null,
        attestationPhotoPath: m.attestationPhotoPath ?? null,
      })),
      policies: (parsed.policies ?? emptyDb().policies).map((p) => ({
        ...p,
        attestationValidUntil: p.attestationValidUntil ?? null,
      })),
      contacts: parsed.contacts?.length ? parsed.contacts : contacts,
      deskFiles: parsed.deskFiles ?? [],
      users: parsed.users ?? [],
    }
  } catch {
    const db = emptyDb()
    await saveDb(db)
    return db
  }
}

export async function saveDb(db: Db): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  await writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8')
}

export function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [...list, item]
  const next = [...list]
  next[i] = item
  return next
}

export function upsertEvidence(list: Evidence[], item: Evidence): Evidence[] {
  const i = list.findIndex((x) => x.incidentId === item.incidentId)
  if (i === -1) return [...list, item]
  const next = [...list]
  next[i] = item
  return next
}
