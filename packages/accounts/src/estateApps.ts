export interface EstateApp {
  appId: string
  /** The production host, served over https only. */
  host: string
  /** `pnpm dev` (Vite) port on localhost. */
  devPort: number
  /** `compose.yml` host port on localhost. */
  composePort: number
}

/** Hub hosts `/account`; these are its localhost ports from the same registry. */
export const HUB_LOCAL_PORTS = { devPort: 3000, composePort: 8080 } as const

/**
 * Every app behind the family gate, and so every origin hub may return a visitor
 * to. Ports mirror the registry in `docs/how-to/adding-an-app.md` and `compose.yml`.
 */
export const ESTATE_APPS: readonly EstateApp[] = [
  { appId: 'boids', host: 'boids.homeofed.com', devPort: 3001, composePort: 8081 },
  { appId: 'fridge', host: 'fridge.homeofed.com', devPort: 3002, composePort: 8082 },
  { appId: 'wotd', host: 'wotd.homeofed.com', devPort: 3003, composePort: 8083 },
  { appId: 'espy', host: 'espy.homeofed.com', devPort: 3006, composePort: 8086 },
  { appId: 'karesansui', host: 'karesansui.homeofed.com', devPort: 3007, composePort: 8087 },
  { appId: 'boop', host: 'boop.homeofed.com', devPort: 3008, composePort: 8088 },
  { appId: 'silt', host: 'silt.homeofed.com', devPort: 3009, composePort: 8089 },
  { appId: 'armoury', host: 'armoury.homeofed.com', devPort: 3011, composePort: 8091 },
]
