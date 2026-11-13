import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { THEME_ORDER } from '../features/sim/themes.ts'

const source = readFileSync(new URL('./tokens.scss', import.meta.url), 'utf8')

function declarations(selector: string): Record<string, string> {
  const start = source.indexOf(`${selector} {`)
  if (start === -1) return {}
  const block = source.slice(start, source.indexOf('}', start))
  const tokens: Record<string, string> = {}
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    tokens[name!] = value!.trim()
  }
  return tokens
}

/** A theme's tokens as `<html data-theme>` resolves them: its own block over `:root`, `var()` followed. */
function themeTokens(theme: string): (name: string) => string {
  const tokens = { ...declarations(':root'), ...declarations(`[data-theme='${theme}']`) }
  const resolve = (name: string): string => {
    const value = tokens[name]
    if (value === undefined) throw new Error(`${theme} has no ${name}`)
    const ref = /^var\((--[\w-]+)\)$/.exec(value)
    return ref ? resolve(ref[1]!) : value
  }
  return resolve
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe('the player circle on every theme', () => {
  it.each(THEME_ORDER)(
    '%s: the initial reads on the accent, and the focus ring on the page',
    (theme) => {
      const token = themeTokens(theme)
      expect(contrast(token('--on-accent'), token('--accent'))).toBeGreaterThanOrEqual(4.5)
      expect(contrast(token('--focus-ring'), token('--bg'))).toBeGreaterThanOrEqual(3)
    },
  )
})
