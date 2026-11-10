// docker-stack-sign-in.mjs - a real sign-in through the docker stack, in a real
// browser: register on hub's /account, add a child, pick who is playing, check
// the hoe_family_session cookie, then check boop saves through the same family.
//
//   docker compose up -d --build family hub boop
//   node scripts/docker-stack-sign-in.mjs            # headless
//   HEADED=1 node scripts/docker-stack-sign-in.mjs   # watch it
//
// Every run registers a fresh parent, so it can be repeated against the same
// database. The invite code is compose.yml's local-only value. Later tickets
// can import `signInThroughStack(page)` to reach a signed-in, picked profile.
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// Playwright is a workspace devDependency, not a root one.
const require = createRequire(new URL('../apps/hub/package.json', import.meta.url))
const { chromium } = require('@playwright/test')

export const STACK = {
  hub: 'http://localhost:8080',
  family: 'http://localhost:8092',
  boop: 'http://localhost:8088',
  inviteCode: 'dev-invite-code',
}

const TIMEOUT = 15_000

/** Leaves `page` on hub's /account with a fresh parent signed in and `child` playing. */
export async function signInThroughStack(page, { child = 'Robin' } = {}) {
  const email = `parent-${Date.now()}@example.com`
  await page.goto(`${STACK.hub}/account`)
  await page.getByRole('heading', { name: 'Sign in' }).waitFor({ timeout: TIMEOUT })

  await page.getByRole('button', { name: 'Register with an invite code' }).click()
  await page.getByLabel('Your name').fill('Ada')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByLabel('Invite code').fill(STACK.inviteCode)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByText('Signed in as Ada').waitFor({ timeout: TIMEOUT })

  await page.getByLabel('Display name').fill(child)
  await page.getByLabel('Username').fill(child.toLowerCase())
  await page.getByRole('button', { name: 'Add profile' }).click()
  await page
    .getByRole('listitem')
    .filter({ hasText: `@${child.toLowerCase()}` })
    .waitFor({
      timeout: TIMEOUT,
    })

  await page.getByRole('button', { name: child, exact: true }).click()
  await page.getByText(`Playing now: ${child}`).waitFor({ timeout: TIMEOUT })
  return { email }
}

async function main() {
  const browser = await chromium.launch({ headless: !process.env.HEADED })
  const page = await browser.newPage()
  const failures = []
  page.on('response', (response) => {
    if (response.url().startsWith(STACK.family) && response.status() >= 400) {
      failures.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    if (request.url().startsWith(STACK.family)) {
      failures.push(`${request.failure()?.errorText} ${request.method()} ${request.url()}`)
    }
  })

  try {
    const { email } = await signInThroughStack(page)
    console.log(`signed in as ${email} and picked Robin`)

    const cookie = (await page.context().cookies()).find((c) => c.name === 'hoe_family_session')
    if (cookie?.domain !== 'localhost') throw new Error('no hoe_family_session cookie on localhost')
    console.log(`hoe_family_session on ${cookie.domain}, httpOnly=${cookie.httpOnly}`)

    // boop reads the cookie hub wrote (cookies are not port-scoped) and calls
    // the family save tier from its own compose origin.
    const firstSave = page.waitForResponse(
      (r) => r.url().startsWith(`${STACK.family}/api/trpc/save.`),
      { timeout: TIMEOUT },
    )
    await page.goto(STACK.boop)
    // boop asks once before linking a device's existing boops (ADR 0080).
    await page
      .getByRole('button', { name: 'Yes, keep them' })
      .click({ timeout: 5_000 })
      .catch(() => {})
    const save = await firstSave
    if (save.status() !== 200) throw new Error(`boop's save call answered ${save.status()}`)
    console.log(`boop saved through family: ${save.status()} ${new URL(save.url()).pathname}`)

    if (failures.length > 0) throw new Error(`failed requests:\n  ${failures.join('\n  ')}`)
    console.log('docker-stack sign-in: OK')
  } catch (error) {
    console.error(`docker-stack sign-in: FAILED\n${error.message}`)
    if (failures.length > 0) console.error(`requests that failed:\n  ${failures.join('\n  ')}`)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
