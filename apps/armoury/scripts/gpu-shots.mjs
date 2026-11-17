// Screenshots of the real stages on the real GPU (ANGLE Metal), for judging by eye.
// node apps/armoury/scripts/gpu-shots.mjs <baseUrl> <outDir> <set.json> [only,names] [--picture] [--reduced-motion]
//   [--clay] [--views=desk,phone] [--box-only] [--close=1200,7000] [--focus=tip,hilt] [--focus-only] [--rolls=20,-40]
//   [--leans=30,-45] [--tips=20,-30] [--leantips=60:45,-30:20] [--face] [--freeze=1.2]
// The set file is { "<name>": { "kind": "wand" | "sword" | "potion", "params": { ... } } }.
// A potion opens at /potions; its close frames default to 100 and 400 ms (rising) and 1200 and 4800 (held), and
// it skips the zoom: --leans, --tips and --leantips (lean:tip pairs, one drag doing both) shoot it while the drag
// still holds it, since it rights itself on release, then a tap away puts it back (r<ms> after). Each is the pose
// wanted in degrees, a lean positive to the right and a tip towards the viewer; the drag is worked out through the
// hold's soft limits, and a pose at or past a limit (60 lean, 45 tip) aims 1 degree short of it. The frames are
// lean<deg>, tip<deg> and lean<deg>tip<deg>, named by the pose asked for. The drags wait for the arrival flourish to
// end, and each fails the run if the bottle as drawn is not within 1.5 degrees of the pose aimed at; the reached
// poses land in <name>-<view>-poses.txt (dev server only). --face touches the bottle as it starts to rise, before
// its idle turn begins, so its label faces the camera in every close frame, lean and tip. A potion's close frames
// are timed from the lift, the close look's first frame; when each was taken, from the tap, lands in
// <name>-<view>-close.txt.
// A full potion mixes 1.9 s into its arrival show, so its later close frames show the mix. A held frame stops the
// stage's clock but not the shop's reveal timer, so its label and shade can show the reveal early.
// --freeze=<seconds> holds a potion's liquid clock (and the candle's flicker) at that moment in every frame (dev server only).
// --clay draws a sword or a potion in plain grey and --focus adds zooms on the tip or hilt (dev server only);
// --box-only skips the close look; --rolls turns the zoomed sword by each angle (degrees) in turn,
// about its length, or with an s (s45) swings it, tip away.
// --flourish=0.5,2.2 shoots the sword's close look that many seconds into its arrival flourish (f<ms>), the
// stage held still at that exact moment on its own clock while the shot is taken (dev server only); --glints=3.9,4.1 then taps the sword again for each, once the last
// flourish is at rest, and shoots it that far in (g<ms>), then puts it back (r<ms> after). Both skip the zoom; times land in <name>-<view>-frames.txt.
// A potion takes --flourish and --glints too (in place of its close frames; a glint's tap replays the show), before
// any drags. --settle=0,100,400 shoots each lean and tip again that many ms of motion after its release (<tag>-s<ms>),
// the stage held still at that moment (a stalled frame steps at most 0.05 s, as the rig and the slosh do); the pose and the liquid surface's wobble from level land beside
// them in <name>-<view>-settle.txt. --early=1 starts the first drag that many seconds into the arrival show instead of
// after it. --views also takes narrow (900x900) and small (360x640).
// --popleans=59,-59 with --popat=2.4,3.1 replays a potion's show once for each lean, drags the bottle to it a second
// in and holds it there through the pop, and shoots the held stage that many seconds into the show (poplean<deg>-f<ms>).
// --browser=firefox or webkit shoots in that browser instead, on whatever WebGL it gives headless (often software).
/* global console, document, URLSearchParams */
import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

import { chromium, firefox, webkit } from '@playwright/test'

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--') && !a.includes('=')))
const options = Object.fromEntries(
  args.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')),
)
const [base, out, setFile, only] = args.filter((a) => !a.startsWith('--'))
if (!base || !out || !setFile) {
  console.error(
    'usage: gpu-shots.mjs <baseUrl> <outDir> <set.json> [only,names] [--picture] [--reduced-motion]',
  )
  process.exit(2)
}
const picture = flags.has('--picture')
const reducedMotion = flags.has('--reduced-motion')
const clay = flags.has('--clay')
const boxOnly = flags.has('--box-only')
const viewTags = options.views ? new Set(options.views.split(',')) : null
const focuses = options.focus ? options.focus.split(',') : []
const focusOnly = flags.has('--focus-only')
const rolls = options.rolls ? options.rolls.split(',') : []
const leans = options.leans ? options.leans.split(',').map(Number) : []
const tips = options.tips ? options.tips.split(',').map(Number) : []
const leantips = options.leantips
  ? options.leantips.split(',').map((pair) => pair.split(':').map(Number))
  : []
const face = flags.has('--face')
const settleAt = options.settle ? options.settle.split(',').map(Number) : []
const early = options.early === undefined ? null : Number(options.early)
const freeze = options.freeze ?? null
// The close look rolls, leans and tips 0.007 radians per pixel dragged.
const PX_PER_DEGREE = Math.PI / 180 / 0.007
// A drag only turns the item once it has travelled further than this.
const TAP_SLOP_PX = 6
// hold.ts: the upright limits and the soft stretch before each.
const LEAN_MAX = 60
const TIP_MAX = 45
const SOFT = 10
// The arrival show holds the bottle upright for its length, which the stage's probe publishes, easing out over 0.3 s.
const FLOURISH_EASE_SECONDS = 0.3
const POSE_TOLERANCE = 1.5
const aimAt = (deg, max) => Math.sign(deg) * Math.min(Math.abs(deg), max - 1)
const RADIANS = Math.PI / 180
const tiltOf = (lean, tip) =>
  Math.acos(Math.cos(lean * RADIANS) * Math.cos(tip * RADIANS)) / RADIANS
// The raw drag, in degrees, that hold.ts's soften turns into `deg`.
const unsoften = (deg, max) => {
  const knee = max - SOFT
  const a = Math.abs(deg)
  return Math.sign(deg) * (a <= knee ? a : knee - SOFT * Math.log(1 - (a - knee) / SOFT))
}
const wanted = only ? new Set(only.split(',')) : null
const seconds = (list) => (list ? list.split(',').map(Number) : [])
const flourishAt = seconds(options.flourish)
const glintAt = seconds(options.glints)
const popLeans = options.popleans ? options.popleans.split(',').map(Number) : []
const popAt = seconds(options.popat)
const flourishing = flourishAt.length + glintAt.length + popLeans.length > 0
// Every glint and rune wake is over this long after a flourish starts.
const AT_REST_SECONDS = 7.5

const set = JSON.parse(readFileSync(setFile, 'utf8'))
mkdirSync(out, { recursive: true })

// The share fragment's payload names the item by its kind: { version: 1, wand: { params } }.
const token = (kind, params) =>
  Buffer.from(JSON.stringify({ version: 1, [kind]: { params } })).toString('base64url')

const views = [
  { tag: 'desk', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  { tag: 'phone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  { tag: 'narrow', viewport: { width: 900, height: 900 }, deviceScaleFactor: 2, asked: true },
  { tag: 'small', viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, asked: true },
]
// Milliseconds after the tap: rising, the wave or flourish, the spell or glint, the glow, at rest.
const CLOSE_FRAMES = options.close
  ? options.close.split(',').map(Number)
  : [1200, 2400, 3600, 4800, 7000]
const POTION_CLOSE_FRAMES = options.close ? CLOSE_FRAMES : [100, 400, 1200, 4800]
const SHOP_PATHS = { wand: '/', sword: '/swords', potion: '/potions' }
// Textures and the HDRI load after the stage chunk; this is time for them to upload and draw.
const SETTLE_MS = 3500
// A screenshot waits its turn when other work is using the GPU; Playwright's own limit is 30 s.
const ACTION_TIMEOUT_MS = 120000

const browserName = options.browser ?? 'chromium'
const browser =
  browserName === 'chromium'
    ? await chromium.launch({
        headless: true,
        channel: 'chromium',
        args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
      })
    : await { firefox, webkit }[browserName].launch({ headless: true })
try {
  for (const [name, { kind, params }] of Object.entries(set)) {
    if (wanted && !wanted.has(name)) continue
    for (const view of views) {
      if (viewTags ? !viewTags.has(view.tag) : view.asked) continue
      const ctx = await browser.newContext({
        viewport: view.viewport,
        deviceScaleFactor: view.deviceScaleFactor,
        reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
        acceptDownloads: true,
      })
      const page = await ctx.newPage()
      page.setDefaultTimeout(ACTION_TIMEOUT_MS)
      const shot = (what) => join(out, `${name}-${view.tag}-${what}.png`)
      // A wand opens at the root as it always has; a sword or a potion goes straight to its shop.
      const search = new URLSearchParams()
      if (clay && kind !== 'wand') search.set('clay', '')
      if (freeze !== null && kind === 'potion') search.set('freeze', freeze)
      const path = `${SHOP_PATHS[kind]}${search.size ? `?${search}` : ''}`
      await page.goto(`${base}${path}#w=${token(kind, params)}`)

      const renderer = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2')
        const info = gl?.getExtension('WEBGL_debug_renderer_info')
        return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'none'
      })
      if (browserName === 'chromium' && !/ANGLE Metal/.test(renderer))
        throw new Error(`not the real GPU: ${renderer}`)

      const item = page.locator('[data-testid="counter"] button[aria-haspopup="dialog"]')
      await item.locator('canvas').waitFor()
      if (!focusOnly) {
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(SETTLE_MS)
        await page.screenshot({ path: shot('scene') })
        await item.screenshot({ path: shot('box') })

        if (picture) {
          const download = page.waitForEvent('download')
          await page.getByRole('button', { name: /^Save a picture/ }).click()
          await (await download).saveAs(shot('picture'))
        }

        if (boxOnly) {
          await ctx.close()
          console.log(`${name} ${view.tag}`)
          continue
        }
        await item.click()
        const tapped = Date.now()
        const shotAt = []
        // The touch runs alongside the close frames, so it cannot hold up the first of them.
        const touched = (async () => {
          await page.getByRole('dialog').waitFor()
          if (kind !== 'potion' || !face) return
          // A drag just past the tap slop counts as a touch, which stops the idle turn; it leans the bottle 0.4 degrees.
          await page.getByRole('dialog').locator('canvas').waitFor()
          // Before the lift a touch lands on nothing the rig holds and reads as a tap, which mixes a full bottle.
          await page.waitForFunction(
            () => document.querySelector('[data-testid="counter"][data-empty]'),
            null,
            { polling: 'raf' },
          )
          const x = view.viewport.width / 2
          const y = view.viewport.height * 0.3
          await page.mouse.move(x, y)
          await page.mouse.down()
          await page.mouse.move(x + TAP_SLOP_PX, y)
          await page.mouse.move(x + TAP_SLOP_PX + 1, y)
          await page.mouse.up()
          shotAt.push(`touched: ${Date.now() - tapped} ms after the tap`)
        })()
        // A potion's frames count from the lift, the close look's first frame, when the counter shows its box empty.
        if (kind === 'potion')
          await page.waitForFunction(
            () => document.querySelector('[data-testid="counter"][data-empty]'),
            null,
            { polling: 'raf' },
          )
        else await page.getByRole('dialog').waitFor()
        const start = Date.now()
        shotAt.push(`started: ${start - tapped} ms after the tap`)
        let waited = 0
        const closeFrames =
          kind === 'potion' ? (flourishing ? [] : POTION_CLOSE_FRAMES) : CLOSE_FRAMES
        for (const ms of closeFrames) {
          // A wand's and a sword's frames keep their old spacing, so they still compare with earlier shots.
          await page.waitForTimeout(
            kind === 'potion' ? Math.max(0, start + ms - Date.now()) : ms - waited,
          )
          waited = ms
          shotAt.push(`close-${ms}: ${Date.now() - tapped} ms after the tap`)
          await page.screenshot({ path: shot(`close-${ms}`) })
        }
        await touched
        writeFileSync(join(out, `${name}-${view.tag}-close.txt`), shotAt.join('\n') + '\n')
        const log = []
        const since = () => page.evaluate(() => globalThis.sinceFlourish ?? null)
        const at = async (s) =>
          page.waitForFunction((s) => (globalThis.sinceFlourish ?? -1) >= s, s, {
            polling: 10,
            timeout: 30000,
          })
        // The stage holds still at exactly `s` while the shot is taken, so a slow screenshot cannot drift.
        const take = async (s, tag) => {
          await page.evaluate((s) => {
            globalThis.holdFlourishAt = s
          }, s)
          await page.waitForFunction((s) => globalThis.heldFlourishAt === s, s, {
            polling: 10,
            timeout: 30000,
          })
          const before = await since()
          await page.screenshot({
            path: shot(`${tag}${String(Math.round(s * 1000)).padStart(5, '0')}`),
          })
          const after = await since()
          log.push(
            `${tag} ${s}s: held at ${before?.toFixed(3)}s, still ${after?.toFixed(3)}s after the shot`,
          )
          await page.evaluate(() => globalThis.resumeFlourish())
        }
        const replay = async () => {
          await at(AT_REST_SECONDS)
          // A tap must land on the item: try a little either side of the middle.
          for (const dx of [0, -0.06, 0.06, -0.12, 0.12]) {
            await page.mouse.click(view.viewport.width * (0.5 + dx), view.viewport.height * 0.4)
            const tapped = await page
              .waitForFunction(() => (globalThis.sinceFlourish ?? 99) < 1, null, {
                polling: 10,
                timeout: 1500,
              })
              .then(() => true)
              .catch(() => false)
            if (tapped) break
          }
        }
        const flourishShots = async () => {
          for (const s of flourishAt) await take(s, 'f')
          for (const s of glintAt) {
            await replay()
            await take(s, 'g')
          }
        }
        if (kind === 'potion') {
          const x = view.viewport.width / 2
          const y = view.viewport.height * 0.45
          if (flourishing) {
            await flourishShots()
            for (const deg of popLeans) {
              await replay()
              await at(1)
              const lean = aimAt(deg, LEAN_MAX)
              await page.mouse.move(x, y)
              await page.mouse.down()
              await page.mouse.move(x, y - TAP_SLOP_PX)
              await page.mouse.move(x + unsoften(lean, LEAN_MAX) * PX_PER_DEGREE, y - TAP_SLOP_PX, {
                steps: 12,
              })
              for (const s of popAt) await take(s, `poplean${deg}-f`)
              const got = await page.evaluate(() => globalThis.potionPose ?? null)
              log.push(`poplean ${deg}: held at lean ${got?.lean.toFixed(1)} through the pop`)
              await page.mouse.up()
            }
            writeFileSync(join(out, `${name}-${view.tag}-frames.txt`), log.join('\n') + '\n')
          }
          const pose = (lean, tip, tag) => ({
            tag,
            lean: aimAt(lean, LEAN_MAX),
            tip: aimAt(tip, TIP_MAX),
          })
          const drags = [
            ...leans.map((deg) => pose(deg, 0, `lean${deg}`)),
            ...tips.map((deg) => pose(0, deg, `tip${deg}`)),
            ...leantips.map(([l, t]) => pose(l, t, `lean${l}tip${t}`)),
          ]
          const poses = []
          const posesFile = join(out, `${name}-${view.tag}-poses.txt`)
          const reached = () => page.evaluate(() => globalThis.potionPose ?? null)
          const settled = []
          const holdMotion = async (t) => {
            await page.evaluate((t) => {
              globalThis.holdMotionAt = t
            }, t)
            await page.waitForFunction(() => typeof globalThis.heldMotionAt === 'number', null, {
              polling: 10,
              timeout: 30000,
            })
          }
          const settleFile = join(out, `${name}-${view.tag}-settle.txt`)
          // Probe values are as of the frame before the one shown, one frame behind it.
          const described = (p) =>
            p
              ? `lean ${p.lean.toFixed(1)} tip ${p.tip.toFixed(1)} (tilt ${p.tilt.toFixed(1)}), wobble ${p.wobble.toFixed(2)} (lean ${p.wobbleLean.toFixed(2)}, tip ${p.wobbleTip.toFixed(2)})`
              : 'no pose published'
          const showSeconds = await page.evaluate(() => globalThis.flourishSeconds ?? null)
          if (drags.length && early === null && showSeconds === null)
            throw new Error(
              `${name} ${view.tag}: the stage published no show length (a dev server?)`,
            )
          const dragFrom = early ?? showSeconds + FLOURISH_EASE_SECONDS
          if (drags.length) {
            const waitFrom = Date.now()
            await page
              .waitForFunction((s) => (globalThis.sinceFlourish ?? -1) >= s, dragFrom, {
                polling: 'raf',
                timeout: 30000,
              })
              .catch(async () => {
                const open = (await page.getByRole('dialog').count()) > 0
                throw new Error(
                  `${name} ${view.tag}: the arrival flourish never reached ${dragFrom} s in 30 s (${open ? 'is the flourish probe mounted, on a dev server?' : 'the close look is gone: did the dev server reload the page?'})`,
                )
              })
            const into = await since()
            poses.push(
              `${early === null ? 'flourish over' : `first drag ${into?.toFixed(2)} s into the show`}: ${Date.now() - start} ms after the lift, waited ${Date.now() - waitFrom} ms`,
            )
          }
          for (const { tag, lean, tip } of drags) {
            await page
              .waitForFunction(() => (globalThis.potionPose?.tilt ?? 99) < 0.5, null, {
                polling: 'raf',
                timeout: 10000,
              })
              .catch(() => {
                throw new Error(
                  `${name} ${view.tag} ${tag}: the bottle never stood upright before the drag`,
                )
              })
            const dx = unsoften(lean, LEAN_MAX) * PX_PER_DEGREE
            const dy = unsoften(tip, TIP_MAX) * PX_PER_DEGREE
            await page.mouse.move(x, y)
            await page.mouse.down()
            // Used up by the tap slop, so all of the drag itself turns the bottle.
            await page.mouse.move(x, y - TAP_SLOP_PX)
            await page.mouse.move(x + dx, y - TAP_SLOP_PX + dy, { steps: 12 })
            await page.waitForTimeout(400)
            const got = await reached()
            const aimed = `lean ${lean.toFixed(1)} tip ${tip.toFixed(1)} (tilt ${tiltOf(lean, tip).toFixed(1)})`
            const line = got
              ? `${tag}: aimed at ${aimed}, reached lean ${got.lean.toFixed(1)} tip ${got.tip.toFixed(1)} (tilt ${got.tilt.toFixed(1)})`
              : `${tag}: aimed at ${aimed}, no pose published`
            poses.push(line)
            writeFileSync(posesFile, poses.join('\n') + '\n')
            if (
              !got ||
              Math.abs(got.lean - lean) > POSE_TOLERANCE ||
              Math.abs(got.tip - tip) > POSE_TOLERANCE
            )
              throw new Error(`${name} ${view.tag} ${line}, not within ${POSE_TOLERANCE} degrees`)
            // With --settle the held shot is taken with the stage still too, so its stall cannot run the clock on past the release.
            if (settleAt.length) await holdMotion(await page.evaluate(() => globalThis.motionClock))
            await page.screenshot({ path: shot(tag) })
            settled.push(`${tag} held: ${described(got)}`)
            if (settleAt.length) await page.evaluate(() => globalThis.resumeFlourish())
            await page.mouse.up()
            const released = await page.evaluate(() => globalThis.motionClock)
            for (const ms of settleAt) {
              await holdMotion(released + ms / 1000)
              const held = await page.evaluate(() => ({
                at: globalThis.heldMotionAt,
                pose: globalThis.potionPose ?? null,
              }))
              await page.screenshot({ path: shot(`${tag}-s${String(ms).padStart(4, '0')}`) })
              settled.push(
                `${tag} s${ms}: held ${Math.round((held.at - released) * 1000)} ms after the release, ${described(held.pose)}`,
              )
              writeFileSync(settleFile, settled.join('\n') + '\n')
              await page.evaluate(() => globalThis.resumeFlourish())
            }
            await page.waitForTimeout(1500)
          }
          await page.mouse.click(view.viewport.width * 0.06, view.viewport.height * 0.5)
          let back = 0
          for (const ms of [150, 450, 1500]) {
            await page.waitForTimeout(ms - back)
            back = ms
            await page.screenshot({ path: shot(`r${String(ms).padStart(5, '0')}`) })
          }
          await ctx.close()
          console.log(`${name} ${view.tag}`)
          continue
        }
        if (flourishing) {
          await flourishShots()
          // A tap away puts it back: the flight down and the sword lying there again.
          await page.mouse.click(view.viewport.width * 0.06, view.viewport.height * 0.5)
          let back = 0
          for (const ms of [150, 450, 1500]) {
            await page.waitForTimeout(ms - back)
            back = ms
            await page.screenshot({ path: shot(`r${String(ms).padStart(5, '0')}`) })
          }
          writeFileSync(join(out, `${name}-${view.tag}-frames.txt`), log.join('\n') + '\n')
          await ctx.close()
          console.log(`${name} ${view.tag}`)
          continue
        }
        await page.mouse.move(view.viewport.width / 2, view.viewport.height * 0.4)
        for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120)
        await page.waitForTimeout(1500)
        await page.screenshot({ path: shot('zoom') })
        for (const turn of rolls) {
          const swing = turn.startsWith('s')
          const px = Number(swing ? turn.slice(1) : turn) * PX_PER_DEGREE
          const x = view.viewport.width / 2
          const y = view.viewport.height * 0.4
          await page.mouse.move(x, y)
          await page.mouse.down()
          await page.mouse.move(swing ? x + px : x, swing ? y : y + px, { steps: 12 })
          // A pause before letting go, so it doesn't carry on spinning.
          await page.waitForTimeout(200)
          await page.mouse.up()
          await page.waitForTimeout(600)
          await page.screenshot({ path: shot(swing ? `swing${turn.slice(1)}` : `roll${turn}`) })
        }
      }
      for (const focus of kind === 'sword' ? focuses : []) {
        const query = new URLSearchParams({ focus })
        if (clay) query.set('clay', '')
        await page.goto(`${base}/swords?${query}#w=${token(kind, params)}`)
        await item.locator('canvas').waitFor()
        await page.waitForTimeout(SETTLE_MS)
        await item.click()
        await page.getByRole('dialog').waitFor()
        await page.waitForTimeout(CLOSE_FRAMES[0])
        await page.mouse.move(view.viewport.width / 2, view.viewport.height * 0.4)
        for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120)
        await page.waitForTimeout(1500)
        await page.screenshot({ path: shot(`zoom-${focus}`) })
      }
      await ctx.close()
      console.log(`${name} ${view.tag}`)
    }
  }
} finally {
  await browser.close()
}
