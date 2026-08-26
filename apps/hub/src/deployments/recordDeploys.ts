/**
 * Records a green deploy into apps/hub/src/generated/deployments.json.
 *
 * Called once per workflow run by the `record-deploys` job, with every app that
 * actually shipped in that push:
 *
 *   node apps/hub/src/deployments/recordDeploys.ts --at 2026-08-25T20:44:07Z silt boop
 *
 * The merge is read-modify-write against the file on disk, so an app added
 * after this checkout was cut is never dropped. No apps means no write, which
 * lets the job call this unconditionally and test `git diff --quiet` after.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { mergeDeploys, serialiseDeployments, type Deployments } from './mergeDeploys.ts'

const DEFAULT_FILE = fileURLToPath(new URL('../generated/deployments.json', import.meta.url))

function fail(message: string): never {
  console.error(`record-deploys: ${message}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const apps: string[] = []
let at: string | undefined
let file = DEFAULT_FILE

let expecting: 'at' | 'file' | null = null
for (const arg of args) {
  if (expecting === 'at') at = arg
  else if (expecting === 'file') file = arg
  else if (arg === '--at') {
    expecting = 'at'
    continue
  } else if (arg === '--file') {
    expecting = 'file'
    continue
  } else apps.push(arg)
  expecting = null
}
if (expecting) fail(`--${expecting} needs a value`)

if (!at) fail('--at <iso-timestamp> is required')
if (Number.isNaN(Date.parse(at))) fail(`--at "${at}" is not a date`)

let current: Deployments
try {
  current = JSON.parse(readFileSync(file, 'utf8')) as Deployments
} catch {
  fail(`could not read ${file}`)
}

if (apps.length === 0) {
  console.log('record-deploys: nothing deployed, leaving the file alone')
  process.exit(0)
}

writeFileSync(file, serialiseDeployments(mergeDeploys(current, apps, at)))
console.log(`record-deploys: ${apps.join(', ')} at ${at}`)
