/**
 * Canvas colour literals (spec §11.3). The chrome (buttons, panel, text) reads
 * CSS custom properties from `styles/tokens.scss`; the canvas can't read CSS
 * vars, so the ink/eye colours live here as literals. Single fixed direction —
 * no theme switcher (divergence 2).
 *
 * Paper is NOT here: it is a generated surface, not a colour — see
 * `render/paper.ts` (its flat average is exported as `PAPER_FLAT`).
 */
export interface SketchbookTheme {
  ink: string
  eyeStroke: string
  eyeWhite: string
}

export const SKETCHBOOK: SketchbookTheme = {
  ink: '#171717',
  eyeStroke: '#141414',
  eyeWhite: '#ffffff',
}
