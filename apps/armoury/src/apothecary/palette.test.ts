import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const scss = readFileSync(new URL('../styles/tokens.scss', import.meta.url), 'utf8')
const block = /\[data-shop='apothecary'\] \{([^}]*)\}/.exec(scss)?.[1] ?? ''
const root = /:root \{([^}]*)\}/.exec(scss)?.[1] ?? ''

const tokensOf = (css: string) =>
  Object.fromEntries(
    [...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1]!, m[2]!]),
  )
const tokens: Record<string, string> = { ...tokensOf(root), ...tokensOf(block) }

const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

const token = (name: string) => {
  const value = tokens[name]
  if (!value) throw new Error(`--${name} is not a colour in the potion shop's tokens`)
  return value
}

// [text, ground, the least ratio]: 4.5 for text, 3 for large text and the focus ring.
const PAIRS: [string, string, number][] = [
  ['ink', 'panel', 4.5],
  ['ink-muted', 'panel', 4.5],
  ['ink-faint', 'panel', 4.5],
  ['lore', 'panel', 4.5],
  ['brass-ink', 'brass', 4.5],
  ['brass', 'panel', 3],
  ['paper-ink', 'paper-shade', 4.5],
  ['paper-ink-soft', 'paper-shade', 4.5],
  ['paper-ink-faint', 'paper-shade', 4.5],
  ['gold-ink', 'gold-paper-shade', 4.5],
  ['gold-ink-soft', 'gold-paper-shade', 4.5],
  ['gold-ink-faint', 'gold-paper-shade', 4.5],
  ['ink-muted', 'scene-lit', 4.5],
  ['ink', 'scene-lit', 4.5],
  ['brass', 'scene-lit', 3],
]

describe("the potion shop's palette", () => {
  it('sets its own colours', () => {
    expect(block).not.toBe('')
    for (const name of ['shop-dark', 'panel', 'ink', 'paper', 'gold-paper', 'scene-lit'])
      expect(tokensOf(block)[name]).toBeDefined()
  })

  it.each(PAIRS)('--%s on --%s is at least %s:1', (text, ground, least) => {
    expect(contrast(token(text), token(ground))).toBeGreaterThanOrEqual(least)
  })
})
