export type AppRole = 'motorist' | 'broker'

export type AuthUser = {
  id: string
  email: string
  role: AppRole
  displayName: string
  onboarded: boolean
  motoristId: string | null
  brokerId: string | null
  vehicleId: string | null
  insurerId: string | null
  policyId: string | null
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type AppUserRecord = AuthUser & {
  passwordHash: string
}
