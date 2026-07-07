// Per-device token (localStorage), used by child login to remember which
// children are registered on a shared family device. Ported from the source
// `lib/device-token.ts`.
const DEVICE_TOKEN_KEY = 'sprout-device-token'

export function getDeviceToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(DEVICE_TOKEN_KEY)
}

export function setDeviceToken(token: string): void {
  localStorage.setItem(DEVICE_TOKEN_KEY, token)
}

export function generateDeviceToken(): string {
  return crypto.randomUUID()
}
