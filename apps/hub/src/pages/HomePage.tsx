import { useEffect, useRef } from 'react'
import styles from './HomePage.module.scss'
import { isNew } from './isNew.ts'
import { useColourTheme } from './useColourTheme'

type PreviewKind = 'boids' | 'magnets' | 'word' | 'ink' | 'idle'
type AppLink = {
  name: string
  status: 'LIVE' | 'SOON'
  kind: PreviewKind
  href?: string
  // ISO date the app went live; drives the "New" pill (see isNew.ts).
  deployedAt?: string
}

const APPS: AppLink[] = [
  { name: 'Boids', status: 'LIVE', kind: 'boids', href: 'https://boids.homeofed.com' },
  { name: 'fridge magnets', status: 'LIVE', kind: 'magnets', href: 'https://fridge.homeofed.com' },
  { name: 'WOTD', status: 'LIVE', kind: 'word', href: 'https://wotd.homeofed.com' },
  {
    name: 'espy',
    status: 'LIVE',
    kind: 'ink',
    href: 'https://espy.homeofed.com',
    deployedAt: '2026-07-09',
  },
  { name: 'HEIG', status: 'SOON', kind: 'idle' },
]

export function HomePage() {
  const [theme, setTheme] = useColourTheme()
  const wordmarkRef = useRef<HTMLHeadingElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)

  useHopAnimation(wordmarkRef)
  usePreviews(galleryRef, theme)

  const now = new Date()

  return (
    <main className={styles.home} data-theme={theme} data-home>
      <button
        type="button"
        className={styles.toggle}
        aria-label="Toggle light/dark theme"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      >
        <span className={theme === 'dark' ? styles.sun : styles.moon} aria-hidden="true" />
      </button>

      <section className={styles.intro}>
        <h1 className={styles.wordmark} ref={wordmarkRef} aria-label="home of ed">
          <span className={styles.letter} data-letter="h" aria-hidden="true">
            h
          </span>
          <span className={styles.letter} data-letter="o" aria-hidden="true">
            o
          </span>
          <span className={styles.letter} data-letter="m" aria-hidden="true">
            m
          </span>
          <span className={styles.letter} data-letter="e" aria-hidden="true">
            e
          </span>
          <span className={styles.gap} data-gap aria-hidden="true" />
          <span aria-hidden="true">ed</span>
          <span className={styles.of} data-of aria-hidden="true">
            of
          </span>
        </h1>
        <p className={styles.lede}>A quiet corner, full of little ideas</p>
      </section>

      <footer className={styles.status}>Made with {`<3`}</footer>

      <nav className={styles.apps} aria-label="apps">
        <div className={styles.gallery} ref={galleryRef}>
          {APPS.map((app) => {
            const inner = (
              <>
                {isNew(app.deployedAt, now) && <span className={styles.newPill}>New</span>}
                <canvas className={styles.preview} data-kind={app.kind} aria-hidden="true" />
                <div className={styles.cardFoot}>
                  <span className={styles.name}>{app.name}</span>
                  {app.status === 'LIVE' ? (
                    <span className={styles.live}>
                      <span className={styles.dot} aria-hidden="true" />
                      LIVE
                    </span>
                  ) : (
                    <span className={styles.soonLabel}>SOON</span>
                  )}
                </div>
              </>
            )
            return app.href ? (
              <a key={app.name} className={styles.card} href={app.href}>
                {inner}
              </a>
            ) : (
              <span key={app.name} className={`${styles.card} ${styles.soon}`}>
                {inner}
              </span>
            )
          })}
        </div>
      </nav>
    </main>
  )
}

/**
 * The "of" hops across the tops of h-o-m-e, then parks in the gap so the
 * wordmark reads "home of ed". Keyframes are generated at runtime by measuring
 * each letter's centre, so the arc stays correct at any font size. Ported from
 * the 2b design reference (reference/hub-homepage/2b-reference.html); querying
 * by data-* attributes keeps it decoupled from hashed CSS-module class names.
 */
function useHopAnimation(ref: React.RefObject<HTMLHeadingElement | null>): void {
  useEffect(() => {
    const title = ref.current
    if (!title) return

    type Key = 'h' | 'o' | 'm' | 'e' | 'gap'
    const KEYS: Key[] = ['h', 'o', 'm', 'e', 'gap']
    const LETTERS = ['h', 'o', 'm', 'e'] as const

    const CONFIG = {
      duration: '4.2s',
      easing: 'cubic-bezier(.45,.05,.4,1)',
      ofScale: 0.5,
      landY: -0.4,
      squashY: -0.4,
      squashScale: [0.54, 0.44] as [number, number],
      apexY: -0.92,
      enterY: -1.15,
      restY: 0,
      restSquashScale: [0.56, 0.42] as [number, number],
      land: { h: 6, o: 18, m: 30, e: 42, gap: 56 } as Record<Key, number>,
      squashOffset: 3,
      apexOffset: -6,
      restSquashAt: 59,
      restEndAt: 63,
      enterVisibleAt: 3,
      dipDepth: 0.05,
      dipScale: [1.02, 0.93] as [number, number],
      dipSpan: 9,
      dipPeakOffset: 4,
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const styleTag = document.createElement('style')
    document.head.appendChild(styleTag)
    // Skip redundant rebuilds (the fonts.ready + setTimeout fallback both fire,
    // and same-size resizes). Rebuilding re-toggles data-measuring, which
    // restarts the hop — so only rebuild when the geometry actually changes.
    let lastSig = ''

    const fmt = (n: number): string => `${Number(n.toFixed(4))}em`
    const scale = (s: number | [number, number]): string =>
      Array.isArray(s) ? `scale(${s[0]},${s[1]})` : `scale(${s})`
    const tf = (xe: number, ye: number, s: number | [number, number]): string =>
      `translate(${fmt(xe)}, ${fmt(ye)}) ${scale(s)}`

    function build(): void {
      const config = CONFIG
      const ofEl = title!.querySelector<HTMLElement>('[data-of]')
      if (!ofEl) return
      const fontSize = parseFloat(getComputedStyle(title!).fontSize)
      // Cheap geometry signature, read without disturbing the animation.
      const signature = `${Math.round(title!.getBoundingClientRect().width)}/${fontSize}`
      if (signature === lastSig) return
      lastSig = signature
      title!.setAttribute('data-measuring', '')
      const titleRect = title!.getBoundingClientRect()
      const centre = (el: Element): number => {
        const rect = el.getBoundingClientRect()
        return (rect.left + rect.width / 2 - titleRect.left) / fontSize
      }
      const query = (selector: string): Element => title!.querySelector(selector)!
      const halfOfWidth = ofEl.getBoundingClientRect().width / 2 / fontSize
      const centres: Record<Key, number> = {
        h: centre(query('[data-letter="h"]')),
        o: centre(query('[data-letter="o"]')),
        m: centre(query('[data-letter="m"]')),
        e: centre(query('[data-letter="e"]')),
        gap: centre(query('[data-gap]')),
      }
      title!.removeAttribute('data-measuring')
      // Left offset that centres the "of" over each landing point.
      const offsets = {} as Record<Key, number>
      for (const key of KEYS) offsets[key] = centres[key] - halfOfWidth

      if (reduce) {
        styleTag.textContent = `[data-of]{opacity:1;transform:${tf(offsets.gap, config.restY, config.ofScale)}}`
        return
      }

      const landAt = config.land
      const frames: [number, string][] = []
      frames.push([0, `opacity:0; transform:${tf(offsets.h, config.enterY, config.ofScale)}`])
      frames.push([
        config.enterVisibleAt,
        `opacity:1; transform:${tf(offsets.h, config.enterY + 0.2, config.ofScale)}`,
      ])
      KEYS.forEach((key, index) => {
        const landPct = landAt[key]
        const landY = key === 'gap' ? config.restY : config.landY
        const squashY = key === 'gap' ? config.restY : config.squashY
        const squashScale = key === 'gap' ? config.restSquashScale : config.squashScale
        if (index > 0) {
          const prev = KEYS[index - 1]!
          frames.push([
            landPct + config.apexOffset,
            `transform:${tf((offsets[prev] + offsets[key]) / 2, config.apexY, config.ofScale)}`,
          ])
        }
        frames.push([landPct, `transform:${tf(offsets[key], landY, config.ofScale)}`])
        frames.push([
          key === 'gap' ? config.restSquashAt : landPct + config.squashOffset,
          `transform:${tf(offsets[key], squashY, squashScale)}`,
        ])
      })
      frames.push([config.restEndAt, `transform:${tf(offsets.gap, config.restY, config.ofScale)}`])
      frames.push([100, `opacity:1; transform:${tf(offsets.gap, config.restY, config.ofScale)}`])
      frames.sort((a, b) => a[0] - b[0])

      const hop = `@keyframes hop{\n${frames.map((frame) => `  ${frame[0]}%{${frame[1]}}`).join('\n')}\n}`
      const dips = LETTERS.map((key) => {
        const landPct = landAt[key]
        const start = landPct
        const end = landPct + config.dipSpan
        const peak = landPct + config.dipPeakOffset
        return `@keyframes dip${key}{\n  0%,${start}%,${end}%,100%{transform:none}\n  ${peak}%{transform:translateY(${fmt(config.dipDepth)}) ${scale(config.dipScale)}}\n}`
      }).join('\n')
      const wiring =
        '[data-measuring] [data-letter],[data-measuring] [data-of]{animation:none!important;transform:none!important}\n' +
        `[data-of]{animation:hop ${config.duration} ${config.easing} 1 both}\n` +
        LETTERS.map(
          (key) =>
            `[data-letter="${key}"]{animation:dip${key} ${config.duration} ease-in-out 1 both}`,
        ).join('\n')
      styleTag.textContent = [hop, dips, wiring].join('\n\n')
    }

    if (document.fonts) void document.fonts.ready.then(build)
    else build()
    const initial = setTimeout(build, 350)

    let timeoutFunc: ReturnType<typeof setTimeout>
    const onResize = (): void => {
      clearTimeout(timeoutFunc)
      timeoutFunc = setTimeout(build, 200)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      clearTimeout(initial)
      clearTimeout(timeoutFunc)
      styleTag.remove()
    }
  }, [ref])
}

/**
 * Each app card carries a small live <canvas> preview of what the app does.
 * The drawers are ported from the homepage-v2 design reference
 * (reference/home-page-v2/home-of-ed.html). They read the current theme through
 * a ref every frame, so a theme toggle recolours the loops without restarting
 * them; the loops themselves start once on mount and stop on unmount.
 */
type DarkRef = { current: boolean }

function usePreviews(ref: React.RefObject<HTMLDivElement | null>, theme: string): void {
  const darkRef = useRef(theme === 'dark')
  useEffect(() => {
    darkRef.current = theme === 'dark'
  }, [theme])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const canvases = Array.from(root.querySelectorAll<HTMLCanvasElement>('canvas[data-kind]'))
    const stops: Array<() => void> = []
    // Delay so each canvas has its laid-out CSS size before we scale for DPR.
    const start = setTimeout(() => {
      for (const cv of canvases) {
        const kind = cv.dataset.kind
        if (kind === 'boids') stops.push(drawBoids(cv, darkRef))
        else if (kind === 'magnets') stops.push(drawMagnets(cv))
        else if (kind === 'word') stops.push(drawWord(cv, darkRef))
        else if (kind === 'ink') stops.push(drawInk(cv, darkRef))
        else stops.push(drawIdle(cv, darkRef))
      }
    }, 90)

    return () => {
      clearTimeout(start)
      for (const stop of stops) stop()
    }
  }, [ref])
}

type Ctx = { ctx: CanvasRenderingContext2D; w: number; h: number }

function cvctx(cv: HTMLCanvasElement): Ctx {
  const w = cv.clientWidth
  const h = cv.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  cv.width = w * dpr
  cv.height = h * dpr
  const ctx = cv.getContext('2d')!
  ctx.scale(dpr, dpr)
  return { ctx, w, h }
}

const ACCENT = { light: '#c07a35', dark: '#e0955f' }

function drawBoids(cv: HTMLCanvasElement, darkRef: DarkRef): () => void {
  const { ctx, w, h } = cvctx(cv)
  const N = 11
  const B = Array.from({ length: N }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 1.2,
    vy: (Math.random() - 0.5) * 1.2,
  }))
  let raf = 0
  const step = (): void => {
    ctx.clearRect(0, 0, w, h)
    const col = darkRef.current ? ACCENT.dark : ACCENT.light
    for (let i = 0; i < N; i++) {
      const b = B[i]!
      let cx = 0
      let cy = 0
      let ax = 0
      let ay = 0
      let n = 0
      for (let j = 0; j < N; j++) {
        if (i === j) continue
        const o = B[j]!
        const dx = o.x - b.x
        const dy = o.y - b.y
        const d = Math.hypot(dx, dy)
        if (d < 46) {
          cx += o.x
          cy += o.y
          ax += o.vx
          ay += o.vy
          n++
          if (d < 16 && d > 0) {
            b.vx -= (dx / d) * 0.06
            b.vy -= (dy / d) * 0.06
          }
        }
      }
      if (n > 0) {
        b.vx += (ax / n - b.vx) * 0.04 + (cx / n - b.x) * 0.001
        b.vy += (ay / n - b.vy) * 0.04 + (cy / n - b.y) * 0.001
      }
      b.vx += (Math.random() - 0.5) * 0.04
      b.vy += (Math.random() - 0.5) * 0.04
      const sp = Math.hypot(b.vx, b.vy)
      if (sp > 1.5) {
        b.vx = (b.vx / sp) * 1.5
        b.vy = (b.vy / sp) * 1.5
      }
      b.x += b.vx
      b.y += b.vy
      if (b.x < 0) b.x = w
      if (b.x > w) b.x = 0
      if (b.y < 0) b.y = h
      if (b.y > h) b.y = 0
      const ang = Math.atan2(b.vy, b.vx)
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(ang)
      ctx.fillStyle = col
      ctx.beginPath()
      ctx.moveTo(5, 0)
      ctx.lineTo(-3, 2.4)
      ctx.lineTo(-3, -2.4)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    raf = requestAnimationFrame(step)
  }
  step()
  return () => cancelAnimationFrame(raf)
}

function drawMagnets(cv: HTMLCanvasElement): () => void {
  const { ctx, w, h } = cvctx(cv)
  const cols = ['#d98a5b', '#7fa99b', '#c96a58', '#8b93b0']
  const chars = ['w', 'o', 'r', 'd']
  const n = 4
  const gap = w / (n + 1)
  const tiles = Array.from({ length: n }, (_, i) => ({
    x: gap * (i + 1),
    y: h / 2,
    ph: i * 1.3,
    ch: chars[i]!,
    col: cols[i]!,
  }))
  let raf = 0
  let t = 0
  const step = (): void => {
    ctx.clearRect(0, 0, w, h)
    t += 0.03
    for (const s of tiles) {
      const y = s.y + Math.sin(t + s.ph) * 5
      const rot = Math.sin(t * 0.8 + s.ph) * 0.13
      ctx.save()
      ctx.translate(s.x, y)
      ctx.rotate(rot)
      ctx.fillStyle = s.col
      ctx.beginPath()
      ctx.roundRect(-12, -12, 24, 24, 4)
      ctx.fill()
      ctx.fillStyle = '#2c322e'
      ctx.font = "700 14px 'Space Grotesk',sans-serif"
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.ch, 0, 1)
      ctx.restore()
    }
    raf = requestAnimationFrame(step)
  }
  step()
  return () => cancelAnimationFrame(raf)
}

function drawWord(cv: HTMLCanvasElement, darkRef: DarkRef): () => void {
  const { ctx, w, h } = cvctx(cv)
  const words = ['petrichor', 'gossamer', 'susurrus', 'limerence']
  let wi = 0
  let ci = 0
  let phase: 'type' | 'hold' | 'erase' = 'type'
  let hold = 0
  const iv = setInterval(() => {
    if (phase === 'type') {
      ci++
      if (ci >= words[wi]!.length) {
        phase = 'hold'
        hold = 0
      }
    } else if (phase === 'hold') {
      hold++
      if (hold > 9) phase = 'erase'
    } else {
      ci--
      if (ci <= 0) {
        phase = 'type'
        wi = (wi + 1) % words.length
      }
    }
  }, 120)
  let raf = 0
  const loop = (): void => {
    const dark = darkRef.current
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = dark ? 'rgba(236,229,218,0.5)' : '#a6a69b'
    ctx.font = "600 8px 'Space Grotesk',sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('W O R D · O F · T H E · D A Y', w / 2, h / 2 - 18)
    const cur = Math.floor(Date.now() / 450) % 2 ? '_' : ' '
    ctx.fillStyle = dark ? '#ece5da' : '#2c322e'
    ctx.font = "700 17px 'Space Grotesk',sans-serif"
    ctx.fillText(words[wi]!.slice(0, ci) + cur, w / 2, h / 2 + 4)
    raf = requestAnimationFrame(loop)
  }
  loop()
  return () => {
    clearInterval(iv)
    cancelAnimationFrame(raf)
  }
}

// espy: an ink blot that breathes gently, with a couple of stray splats and a
// pair of eyes — the app in miniature. Ink + eye colours track the hub theme so
// the blot reads on the card in both light and dark.
function drawInk(cv: HTMLCanvasElement, darkRef: DarkRef): () => void {
  const { ctx, w, h } = cvctx(cv)
  const cx = w / 2
  const cy = h / 2 + 2
  const N = 16
  const R = 25
  const blob = Array.from({ length: N }, (_, i) => ({
    a: (i / N) * Math.PI * 2,
    r: R * (0.82 + Math.random() * 0.34),
  }))
  const splats = Array.from({ length: 3 }, () => ({
    dx: (Math.random() - 0.5) * 78,
    dy: (Math.random() - 0.5) * 46,
    r: 1.5 + Math.random() * 3,
  }))
  let raf = 0
  let t = 0
  const step = (): void => {
    const dark = darkRef.current
    const ink = dark ? '#ece5da' : '#2c322e'
    const sclera = dark ? '#2b2d27' : '#f3ede2'
    ctx.clearRect(0, 0, w, h)
    t += 0.02
    const breathe = 1 + Math.sin(t) * 0.03
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(breathe, breathe)
    ctx.fillStyle = ink
    ctx.beginPath()
    blob.forEach((p, i) => {
      const x = Math.cos(p.a) * p.r
      const y = Math.sin(p.a) * p.r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.fill()
    for (const s of splats) {
      ctx.beginPath()
      ctx.arc(s.dx, s.dy, s.r, 0, 6.28)
      ctx.fill()
    }
    const eye = (ex: number): void => {
      ctx.fillStyle = sclera
      ctx.beginPath()
      ctx.arc(ex, -6, 5, 0, 6.28)
      ctx.fill()
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.arc(ex + 1, -5, 2, 0, 6.28)
      ctx.fill()
    }
    eye(-8)
    eye(9)
    ctx.restore()
    raf = requestAnimationFrame(step)
  }
  step()
  return () => cancelAnimationFrame(raf)
}

function drawIdle(cv: HTMLCanvasElement, darkRef: DarkRef): () => void {
  const { ctx, w, h } = cvctx(cv)
  let raf = 0
  let t = 0
  const step = (): void => {
    const dark = darkRef.current
    ctx.clearRect(0, 0, w, h)
    t += 0.02
    const r = 9 + Math.sin(t) * 3
    ctx.strokeStyle = dark ? 'rgba(236,229,218,0.28)' : 'rgba(44,50,46,0.2)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.arc(w / 2, h / 2 - 4, r, 0, 6.28)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = dark ? 'rgba(236,229,218,0.4)' : 'rgba(44,50,46,0.28)'
    ctx.font = "600 8px 'Space Grotesk',sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('IN THE WORKS', w / 2, h / 2 + 20)
    raf = requestAnimationFrame(step)
  }
  step()
  return () => cancelAnimationFrame(raf)
}
