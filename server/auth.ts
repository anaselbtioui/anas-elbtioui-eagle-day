import { randomBytes, scrypt as scryptCb, timingSafeEqual, randomUUID } from 'node:crypto'
import { promisify } from 'node:util'
import { sign, verify } from 'hono/jwt'
import type { AppRole, AppUserRecord, AuthUser } from '../src/domain/auth.ts'
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

export async function userFromToken(db: Db, token: string): Promise<AuthUser | null> {
  try {
    const payload = await verify(token, jwtSecret(), 'HS256')
    const id = typeof payload.sub === 'string' ? payload.sub : null
    if (!id) return null
    const row = db.users.find((u) => u.id === id)
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
  brokerId: string
  policyId: string
} {
  const motoristId = randomUUID()
  const vehicleId = randomUUID()
  const insurerId = randomUUID()
  const brokerId = randomUUID()
  const policyId = randomUUID()
  return {
    motoristId,
    vehicleId,
    insurerId,
    brokerId,
    policyId,
    db: {
      ...db,
      motorists: upsert(db.motorists, {
        id: motoristId,
        name: displayName,
        phone: null,
        alsoTellEmployerIfCommute: false,
      }),
      vehicles: upsert(db.vehicles, { id: vehicleId, plate: null, makeModel: null }),
      insurers: upsert(db.insurers, { id: insurerId, displayName: 'Assureur' }),
      brokers: upsert(db.brokers, { id: brokerId, displayName: 'Courtier' }),
      policies: upsert(db.policies, {
        id: policyId,
        number: null,
        insurerId,
        brokerId,
        vehicleId,
        assistanceOnContract: 'unknown',
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

export function isRole(value: string | undefined): value is AppRole {
  return value === 'motorist' || value === 'broker'
}
