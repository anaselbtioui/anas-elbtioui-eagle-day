let token: string | null = null

export function setAuthToken(next: string | null): void {
  token = next
}

export function getAuthToken(): string | null {
  return token
}
