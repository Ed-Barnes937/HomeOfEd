/**
 * The apps allowed to use the SaveStore, v1 being boop alone (spec §4.6). One
 * table drives two gates - the `appId` the handlers accept and the browser
 * origin CORS lets through - so neither can be widened without the other.
 */
export const ONBOARDED_APPS = [
  { appId: 'boop', host: 'boop.homeofed.com', devPort: 3008, composePort: 8088 },
] as const

export function isOnboardedApp(appId: string): boolean {
  return ONBOARDED_APPS.some((app) => app.appId === appId)
}

export function onboardedAppOrigins(): readonly string[] {
  return ONBOARDED_APPS.map((app) => `https://${app.host}`)
}

export function onboardedAppDevOrigins(): readonly string[] {
  return ONBOARDED_APPS.map((app) => `http://localhost:${app.devPort}`)
}

export function onboardedAppComposeOrigins(): readonly string[] {
  return ONBOARDED_APPS.map((app) => `http://localhost:${app.composePort}`)
}
