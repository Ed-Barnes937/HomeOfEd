/**
 * The pure half of the deploy recorder (see recordDeploys.ts for the CLI).
 *
 * CI appends a fact after every green deploy — "this app is now serving a new
 * version" — and the homepage turns it into the New / Updated pills.
 * `firstDeployedAt` is written once and never rewritten: it is the launch date,
 * and it is what makes an app "new". `lastDeployedAt` moves on every deploy.
 */
export type DeployRecord = {
  firstDeployedAt: string
  lastDeployedAt: string
}

export type Deployments = Record<string, DeployRecord>

export function mergeDeploys(current: Deployments, apps: string[], at: string): Deployments {
  const merged: Deployments = { ...current }
  for (const app of apps) {
    merged[app] = {
      firstDeployedAt: merged[app]?.firstDeployedAt ?? at,
      lastDeployedAt: at,
    }
  }
  return merged
}

/**
 * Keys sorted and a trailing newline, so a recorded deploy shows up in the CI
 * commit as one changed line per app rather than a reshuffle of the whole file.
 */
export function serialiseDeployments(deployments: Deployments): string {
  const sorted: Deployments = {}
  for (const [app, record] of Object.entries(deployments).sort(([a], [b]) => (a < b ? -1 : 1))) {
    sorted[app] = record
  }
  return `${JSON.stringify(sorted, null, 2)}\n`
}
