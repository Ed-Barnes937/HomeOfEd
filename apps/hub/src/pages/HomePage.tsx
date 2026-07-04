import { useEffect, useRef } from 'react'
import styles from './HomePage.module.scss'
import { useColourTheme } from './useColourTheme'

type AppLink = { name: string; status: string; href?: string }

const APPS: AppLink[] = [
  { name: 'Boids', status: 'LIVE', href: 'https://boids.homeofed.com' },
  { name: 'fridge magnets', status: 'LIVE', href: 'https://fridge.homeofed.com' },
  { name: 'HEIG', status: 'SOON' },
  { name: 'WOTD', status: 'SOON' },
]

export function HomePage() {
  const [theme, setTheme] = useColourTheme()
  const wordmarkRef = useRef<HTMLHeadingElement>(null)

  useHopAnimation(wordmarkRef)

  return (
    <main className={styles.home} data-theme={theme} data-home>
      <button
        type="button"
        className={styles.toggle}
        aria-label="Toggle light/dark theme"
        onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      >
        {theme === 'dark' ? '☀' : '☾'}
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

      <nav className={styles.apps} aria-label="apps">
        {APPS.map((app) =>
          app.href ? (
            <a key={app.name} className={styles.app} href={app.href}>
              <span className={styles.name}>{app.name}</span>
              <span className={styles.line} aria-hidden="true" />
              <span className={styles.statusLabel}>{app.status}</span>
            </a>
          ) : (
            <span key={app.name} className={`${styles.app} ${styles.soon}`}>
              <span className={styles.name}>{app.name}</span>
              <span className={styles.line} aria-hidden="true" />
              <span className={styles.statusLabel}>{app.status}</span>
            </span>
          ),
        )}
      </nav>

      <footer className={styles.status}>Made with {`<3`}</footer>
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
