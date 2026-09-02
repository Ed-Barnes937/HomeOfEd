/**
 * Joins a homepage card to what CI recorded about its deploys.
 *
 * The card's display name ("fridge magnets", "Silt") is not the key — the
 * workspace package name is, because that is what the deploy jobs know
 * themselves as. See ../deployments/mergeDeploys.ts for who writes the file.
 *
 * An app with no recorded deploy gets no dates, which both isNew and isUpdated
 * already read as "show no pill" — that covers SOON cards and any app added
 * before its first deploy lands.
 */
import type { Deployments } from '../deployments/mergeDeploys.ts'
// The `with` attribute is what lets this same module load under Node (the
// .iwft tests run there) as well as through Vite.
import deployments from '../generated/deployments.json' with { type: 'json' }

export type AppDates = {
  deployedAt?: string
  updatedAt?: string
}

export function appDates(pkg: string | undefined): AppDates {
  if (!pkg) return {}
  const record = (deployments as Deployments)[pkg]
  if (!record) return {}
  return { deployedAt: record.firstDeployedAt, updatedAt: record.lastDeployedAt }
}
