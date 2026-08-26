import type { ElementRegistry } from '../../sim/index.ts'
import { SimRenderer, type WorldRenderer } from './renderer.ts'
import { WebGLSimRenderer } from './webglRenderer.ts'

/**
 * Renderer selection (120fps ticket 01): WebGL2 when the canvas provides a
 * context, the Canvas 2D `SimRenderer` otherwise — the 2D path is the live
 * fallback, not dead code.
 */

/** Just the sliver of `HTMLCanvasElement` selection needs — pure, so vitest can drive it with fakes. */
export interface Webgl2Source {
  getContext(contextId: 'webgl2'): unknown
}

export type SelectedRenderer = { kind: '2d' } | { kind: 'webgl2'; gl: WebGL2RenderingContext }

export function selectRenderer(canvas: Webgl2Source): SelectedRenderer {
  let gl: unknown = null
  try {
    gl = canvas.getContext('webgl2')
  } catch {
    gl = null
  }
  return gl ? { kind: 'webgl2', gl: gl as WebGL2RenderingContext } : { kind: '2d' }
}

export function createRenderer(canvas: HTMLCanvasElement, registry: ElementRegistry): WorldRenderer {
  const selected = selectRenderer(canvas)
  if (selected.kind === 'webgl2') return new WebGLSimRenderer(canvas, selected.gl, registry)
  return new SimRenderer(canvas, registry)
}
