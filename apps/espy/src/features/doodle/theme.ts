/**
 * Canvas colour literals (spec §11.3). The chrome (buttons, panel, text) reads
 * CSS custom properties from `styles/tokens.scss`; the canvas can't read CSS
 * vars, so the paper/ink/eye colours live here as literals. Single fixed
 * direction — no theme switcher (divergence 2).
 */
export interface SketchbookTheme {
  paper: string
  ink: string
  eyeStroke: string
  eyeWhite: string
}

export const SKETCHBOOK: SketchbookTheme = {
  paper: '#fffdf4',
  ink: '#171717',
  eyeStroke: '#141414',
  eyeWhite: '#ffffff',
}
