import { randomBytes, scrypt as scryptCb, timingSafeEqual, randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { sign, verify } from 'hono/jwt'
import type { AppRole, AppUserRecord, AuthUser } from '@labas/domain/auth.ts'
import { upsert, type Db } from './store.ts'

const scrypt = promisify(scryptCb)
/** Access JWT lifetime. Override with LABAS_JWT_TTL_MINUTES. */
const TOKEN_MINUTES = Number(process.env.LABAS_JWT_TTL_MINUTES) || 15

export function publicUser(row: AppUserRecord): AuthUser {
  const { passwordHash: _pw, ...user } = row
  return user
}

function jwtSecret(): string {
  return process.env.LABAS_JWT_SECRET ?? 'labas-dev-jwt'
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = (await scrypt(password, salt, 32)) as Buffer
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const actual = (await scrypt(password, salt, expected.length)) as Buffer
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export async function signToken(user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  return sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      displayName: user.displayName,
      onboarded: user.onboarded,
      motoristId: user.motoristId,
      brokerId: user.brokerId,
      vehicleId: user.vehicleId,
      insurerId: user.insurerId,
      policyId: user.policyId,
      exp: now + TOKEN_MINUTES * 60,
    },
    jwtSecret(),
    'HS256',
  )
}

export async function userFromToken(db: Db | null, token: string): Promise<AuthUser | null> {
  try {
    const payload = await verify(token, jwtSecret(), 'HS256')
    const id = typeof payload.sub === 'string' ? payload.sub : null
    if (!id) return null
    const row = db?.users.find((u) => u.id === id)
    if (row) return publicUser(row)
    // JWT still valid but row missing (e.g. store rewrite race) — trust claims for session continuity.
    const role = payload.role === 'broker' || payload.role === 'motorist' ? payload.role : null
    const email = typeof payload.email === 'string' ? payload.email : ''
    const displayName = typeof payload.displayName === 'string' ? payload.displayName : email
    if (!role) return null
    return {
      id,
      email,
      role,
      displayName,
      onboarded: payload.onboarded === true || role === 'broker',
      motoristId: typeof payload.motoristId === 'string' ? payload.motoristId : null,
      brokerId: typeof payload.brokerId === 'string' ? payload.brokerId : null,
      vehicleId: typeof payload.vehicleId === 'string' ? payload.vehicleId : null,
      insurerId: typeof payload.insurerId === 'string' ? payload.insurerId : null,
      policyId: typeof payload.policyId === 'string' ? payload.policyId : null,
    }
  } catch {
    return null
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function provisionMotorist(db: Db, displayName: string): {
  db: Db
  motoristId: string
  vehicleId: string
  insurerId: string
  policyId: string
} {
  const motoristId = randomUUID()
  const vehicleId = randomUUID()
  const insurerId = randomUUID()
  const policyId = randomUUID()
  return {
    motoristId,
    vehicleId,
    insurerId,
    policyId,
    db: {
      ...db,
      motorists: upsert(db.motorists, {
        id: motoristId,
        name: displayName,
        phone: null,
        alsoTellEmployerIfCommute: false,
        cin: null,
        city: null,
        licenseNumber: null,
        licensePhotoPath: null,
        carteGrisePhotoPath: null,
        attestationPhotoPath: null,
      }),
      vehicles: upsert(db.vehicles, { id: vehicleId, plate: null, makeModel: null }),
      insurers: upsert(db.insurers, { id: insurerId, displayName: 'Assureur' }),
      policies: upsert(db.policies, {
        id: policyId,
        number: null,
        insurerId,
        brokerId: null,
        vehicleId,
        assistanceOnContract: 'unknown',
        attestationValidUntil: null,
      }),
    },
  }
}

export function provisionBroker(db: Db, displayName: string): { db: Db; brokerId: string } {
  const brokerId = randomUUID()
  return {
    brokerId,
    db: {
      ...db,
      brokers: upsert(db.brokers, { id: brokerId, displayName }),
    },
  }
}

export function insertUser(db: Db, row: AppUserRecord): Db {
  return { ...db, users: upsert(db.users, row) }
}

export function markOnboarded(db: Db, userId: string): Db {
  const row = db.users.find((u) => u.id === userId)
  if (!row) return db
  return insertUser(db, { ...row, onboarded: true })
}

/** Bind motorist account + policy to a registered broker. */
export function assignMotoristBroker(
  db: Db,
  userId: string,
  policyId: string,
  brokerId: string,
): Db {
  const user = db.users.find((u) => u.id === userId)
  const policy = db.policies.find((p) => p.id === policyId)
  const broker = db.brokers.find((b) => b.id === brokerId)
  if (!user || user.role !== 'motorist' || !policy || !broker) return db
  const registered = db.users.some((u) => u.role === 'broker' && u.brokerId === brokerId)
  if (!registered) return db
  return {
    ...db,
    policies: upsert(db.policies, { ...policy, brokerId }),
    users: upsert(db.users, { ...user, brokerId }),
  }
}

/** Brokers that have a real app account (not orphan stubs). */
export function listRegisteredBrokers(db: Db): Array<{
  id: string
  displayName: string
  email: string
}> {
  return db.users
    .filter((u) => u.role === 'broker' && u.brokerId)
    .map((u) => {
      const row = db.brokers.find((b) => b.id === u.brokerId)
      return {
        id: u.brokerId!,
        displayName: row?.displayName || u.displayName,
        email: u.email,
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr'))
}

export function listBrokerClients(db: Db, brokerId: string) {
  const clients: Array<{
    motoristId: string
    name: string
    phone: string | null
    email: string | null
    policyNumber: string | null
    plate: string | null
  }> = []
  const seen = new Set<string>()

  for (const u of db.users) {
    if (u.role !== 'motorist' || !u.motoristId) continue
    const policy = u.policyId ? db.policies.find((p) => p.id === u.policyId) : null
    if (u.brokerId !== brokerId && policy?.brokerId !== brokerId) continue
    const motorist = db.motorists.find((m) => m.id === u.motoristId)
    if (!motorist) continue
    seen.add(motorist.id)
    const vehicle = policy ? db.vehicles.find((v) => v.id === policy.vehicleId) : undefined
    clients.push({
      motoristId: motorist.id,
      name: motorist.name,
      phone: motorist.phone,
      email: u.email,
      policyNumber: policy?.number ?? null,
      plate: vehicle?.plate ?? null,
    })
  }

  // Policies linked without matching user.brokerId yet
  for (const p of db.policies) {
    if (p.brokerId !== brokerId) continue
    const user = db.users.find((u) => u.role === 'motorist' && u.policyId === p.id)
    if (user?.motoristId && seen.has(user.motoristId)) continue
    if (!user?.motoristId) continue
    const motorist = db.motorists.find((m) => m.id === user.motoristId)
    if (!motorist || seen.has(motorist.id)) continue
    seen.add(motorist.id)
    const vehicle = db.vehicles.find((v) => v.id === p.vehicleId)
    clients.push({
      motoristId: motorist.id,
      name: motorist.name,
      phone: motorist.phone,
      email: user.email,
      policyNumber: p.number,
      plate: vehicle?.plate ?? null,
    })
  }

  return clients.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

export function isRole(value: string | undefined): value is AppRole {
  return value === 'motorist' || value === 'broker'
}
