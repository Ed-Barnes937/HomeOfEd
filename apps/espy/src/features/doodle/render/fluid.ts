/**
 * The ink-in-water field (feedback: the procedural/watercolour looks read as
 * artificial). A compact WebGL2 stable-fluids solver (Stam-style: advect →
 * vorticity → project → advect dye) run as a TRANSIENT overlay canvas.
 *
 * The generated blots seed dye drops with a small velocity kick; the sim blooms
 * them for ~`FLUID_MS`, then FREEZES and bakes the final frame to a plain 2D
 * canvas that the caller keeps as the field art. Nothing simulates after the
 * bake — undo/resize/save just redraw the baked bitmap — so the emergent shape
 * is fixed the moment it settles.
 *
 * Like `surface.ts`, this is a render-layer module: it is one of the few places
 * allowed to touch a canvas/GL context. The engine stays pure; the maths that
 * turns blots into splats lives in the pure `fluid.helpers.ts`.
 */
import { hexToRgb01 } from './fluid.color.ts'
import { buildSplats, splatRng, type Brush, type FluidSeed } from './fluid.helpers.ts'
import { DEFAULT_TUNING, type FluidTuning } from './fluid.tuning.ts'

/** Bloom duration before the field freezes and bakes (ms). */
export const FLUID_MS = 1800

// Sim grid resolutions (velocity is coarse; dye carries the visible detail).
const SIM_RES = 128
const DYE_RES = 512
const PRESSURE_ITERATIONS = 22
const DT = 0.016
// VELOCITY_DISSIPATION / DENSITY_DISSIPATION / VORTICITY and the watercolour
// display numbers are tunable — see `fluid.tuning.ts`.

export interface FluidFieldOptions {
  /** Element the transient GL canvas is positioned over (usually the 2D canvas). */
  overCanvas: HTMLCanvasElement
  cssW: number
  cssH: number
  dpr: number
  seeds: readonly FluidSeed[]
  paper: string
  ink: string
  /** Numeric seed for the (visual-only) splat asymmetry rng. */
  rngSeed: number
  /** Show the bloom animating (false → run to settled and bake, no visible motion). */
  animate: boolean
  /** Tunable look knobs (defaults to the baked-in look). */
  tuning?: FluidTuning
  /** Debug (`?tune` grid): force seed i to `forceBrushes[i]`. */
  forceBrushes?: readonly Brush[]
  signal?: AbortSignal
}

/** True if this browser can run the sim (WebGL2 + float render targets). */
export function fluidSupported(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    return !!gl && !!gl.getExtension('EXT_color_buffer_float')
  } catch {
    return false
  }
}

// --- GLSL ------------------------------------------------------------------

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
uniform vec2 texelSize;
void main(){
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const ADVECTION = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float dissipation;
void main(){
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
  vec4 result = texture(uSource, coord);
  float decay = 1.0 + dissipation * dt;
  outColor = result / decay;
}`

const DIVERGENCE = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  float div = 0.5 * (R - L + T - B);
  outColor = vec4(div, 0.0, 0.0, 1.0);
}`

const CURL = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main(){
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  float curl = R - L - T + B;
  outColor = vec4(0.5 * curl, 0.0, 0.0, 1.0);
}`

const VORTICITY_SHADER = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main(){
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy + force * dt;
  outColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`

const PRESSURE = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main(){
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  float p = (L + R + B + T - div) * 0.25;
  outColor = vec4(p, 0.0, 0.0, 1.0);
}`

const GRADIENT_SUBTRACT = `#version 300 es
precision highp float;
in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main(){
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  outColor = vec4(vel, 0.0, 1.0);
}`

const SPLAT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
void main(){
  vec2 p = vUv - point;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture(uTarget, vUv).xyz;
  outColor = vec4(base + splat, 1.0);
}`

// Watercolour display: threshold the diffused dye into a CRISP silhouette (the
// paint edge is where the wash reached a coverage level — fainter wash is bare
// paper, not a fuzzy halo), pool pigment darker in a thin band just inside that
// edge, and mottle the fill with granulation. Monochrome (ADR 0016). The knobs
// are tunable (`fluid.tuning.ts`), so the shader is built per run.
const displayFragment = (t: FluidTuning): string => `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTexture;
uniform vec2 texelSize;
uniform vec3 paper;
uniform vec3 ink;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// 3×3 gaussian-weighted read — smooths the fluid's fine boundary tendrils so the
// thresholded silhouette wobbles organically instead of spiking.
float smoothC(vec2 uv){
  vec2 e = texelSize * ${t.smoothTexels.toFixed(3)};
  float c = texture(uTexture, uv).x * 0.28;
  c += (texture(uTexture, uv + vec2(e.x, 0.0)).x + texture(uTexture, uv - vec2(e.x, 0.0)).x
      + texture(uTexture, uv + vec2(0.0, e.y)).x + texture(uTexture, uv - vec2(0.0, e.y)).x) * 0.12;
  c += (texture(uTexture, uv + e).x + texture(uTexture, uv - e).x
      + texture(uTexture, uv + vec2(e.x, -e.y)).x + texture(uTexture, uv - vec2(e.x, -e.y)).x) * 0.06;
  return c;
}

void main(){
  float c = smoothC(vUv);
  // Crisp silhouette: coverage crosses the threshold over ~1px of the field.
  float aa = fwidth(c) * 1.5 + 0.0008;
  float cov = smoothstep(${t.threshold.toFixed(3)} - aa, ${t.threshold.toFixed(3)} + aa, c);
  if (cov <= 0.0) { outColor = vec4(paper, 1.0); return; }
  // Edge-darkening: a thin pooled band just inside the boundary, fading in.
  float rim = (1.0 - smoothstep(${t.threshold.toFixed(3)}, ${(t.threshold + t.rimBand).toFixed(3)}, c)) * ${t.edgeGain.toFixed(3)};
  // Granulation across the wash.
  float gran = (vnoise(vUv * ${t.grainScale.toFixed(1)}) - 0.5) * ${t.grainAmount.toFixed(3)};
  float tone = cov * clamp(${t.washMax.toFixed(3)} + rim + gran, 0.0, 1.0);
  outColor = vec4(mix(paper, ink, tone), 1.0);
}`

// --- GL plumbing -----------------------------------------------------------

type GL = WebGL2RenderingContext

function compile(gl: GL, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)!
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh) ?? ''}`)
  }
  return sh
}

function program(gl: GL, fragSrc: string): WebGLProgram {
  const p = gl.createProgram()
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fragSrc))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(p) ?? ''}`)
  }
  return p
}

interface Fbo {
  tex: WebGLTexture
  fbo: WebGLFramebuffer
  w: number
  h: number
  texelX: number
  texelY: number
}
interface DoubleFbo {
  read: Fbo
  write: Fbo
  swap: () => void
}

function makeFbo(gl: GL, w: number, h: number): Fbo {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  gl.viewport(0, 0, w, h)
  gl.clear(gl.COLOR_BUFFER_BIT)
  return { tex, fbo, w, h, texelX: 1 / w, texelY: 1 / h }
}

function makeDoubleFbo(gl: GL, w: number, h: number): DoubleFbo {
  const state = { read: makeFbo(gl, w, h), write: makeFbo(gl, w, h) }
  return {
    get read() {
      return state.read
    },
    get write() {
      return state.write
    },
    swap() {
      const t = state.read
      state.read = state.write
      state.write = t
    },
  }
}

/**
 * Run the ink bloom and resolve with a 2D canvas holding the baked field
 * (ink over paper), sized to the backing store. Rejects if aborted.
 */
export function runFluidField(opts: FluidFieldOptions): Promise<HTMLCanvasElement> {
  const { overCanvas, cssW, cssH, dpr, seeds, paper, ink, rngSeed, animate, signal } = opts
  const tuning = opts.tuning ?? DEFAULT_TUNING
  const scale = Math.min(dpr, 2)
  const w = Math.max(1, Math.round(cssW * scale))
  const h = Math.max(1, Math.round(cssH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  Object.assign(canvas.style, {
    position: 'absolute',
    left: `${overCanvas.offsetLeft}px`,
    top: `${overCanvas.offsetTop}px`,
    width: `${cssW}px`,
    height: `${cssH}px`,
    pointerEvents: 'none',
    zIndex: '2',
  })
  overCanvas.parentElement?.appendChild(canvas)

  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  })
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) {
    canvas.remove()
    return Promise.reject(new Error('WebGL2 float targets unavailable'))
  }
  gl.getExtension('OES_texture_float_linear')

  // Fullscreen triangle.
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

  const progs = {
    advection: program(gl, ADVECTION),
    divergence: program(gl, DIVERGENCE),
    curl: program(gl, CURL),
    vorticity: program(gl, VORTICITY_SHADER),
    pressure: program(gl, PRESSURE),
    gradient: program(gl, GRADIENT_SUBTRACT),
    splat: program(gl, SPLAT),
    display: program(gl, displayFragment(tuning)),
  }
  const uni = (p: WebGLProgram, name: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(p, name)

  const dyeW = Math.round(DYE_RES * (w >= h ? w / h : 1))
  const dyeH = Math.round(DYE_RES * (h > w ? h / w : 1))
  const simW = Math.round(SIM_RES * (w >= h ? w / h : 1))
  const simH = Math.round(SIM_RES * (h > w ? h / w : 1))

  const velocity = makeDoubleFbo(gl, simW, simH)
  const dye = makeDoubleFbo(gl, dyeW, dyeH)
  const divergence = makeFbo(gl, simW, simH)
  const curl = makeFbo(gl, simW, simH)
  const pressure = makeDoubleFbo(gl, simW, simH)

  const blit = (target: Fbo | null): void => {
    if (target) {
      gl.viewport(0, 0, target.w, target.h)
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
    } else {
      gl.viewport(0, 0, w, h)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
  const bindTex = (p: WebGLProgram, name: string, tex: WebGLTexture, unit: number): void => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(uni(p, name), unit)
  }

  const [pr, pg, pb] = hexToRgb01(paper)
  const [ir, ig, ib] = hexToRgb01(ink)

  // --- Seeding: dye + velocity splats from the blots ------------------------
  const splats = buildSplats(seeds, cssW, cssH, splatRng(rngSeed), tuning, opts.forceBrushes)
  const aspect = simW / simH
  const dyeAspect = dyeW / dyeH
  const splat = (
    dfbo: DoubleFbo,
    aspectRatio: number,
    x: number,
    y: number,
    radius: number,
    r: number,
    g: number,
    b: number,
  ): void => {
    gl.useProgram(progs.splat)
    bindTex(progs.splat, 'uTarget', dfbo.read.tex, 0)
    gl.uniform1f(uni(progs.splat, 'aspectRatio'), aspectRatio)
    gl.uniform2f(uni(progs.splat, 'point'), x, y)
    gl.uniform1f(uni(progs.splat, 'radius'), radius * radius)
    gl.uniform3f(uni(progs.splat, 'color'), r, g, b)
    blit(dfbo.write)
    dfbo.swap()
  }
  for (const s of splats) {
    splat(dye, dyeAspect, s.x, s.y, s.radius, s.dye, s.dye, s.dye)
    if (s.vx !== 0 || s.vy !== 0) {
      splat(velocity, aspect, s.x, s.y, s.radius, s.vx / DT, s.vy / DT, 0)
    }
  }

  // --- One sim step ---------------------------------------------------------
  const step = (): void => {
    // curl
    gl.useProgram(progs.curl)
    gl.uniform2f(uni(progs.curl, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    bindTex(progs.curl, 'uVelocity', velocity.read.tex, 0)
    blit(curl)

    // vorticity confinement
    gl.useProgram(progs.vorticity)
    gl.uniform2f(uni(progs.vorticity, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    bindTex(progs.vorticity, 'uVelocity', velocity.read.tex, 0)
    bindTex(progs.vorticity, 'uCurl', curl.tex, 1)
    gl.uniform1f(uni(progs.vorticity, 'curl'), tuning.vorticity)
    gl.uniform1f(uni(progs.vorticity, 'dt'), DT)
    blit(velocity.write)
    velocity.swap()

    // divergence
    gl.useProgram(progs.divergence)
    gl.uniform2f(uni(progs.divergence, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    bindTex(progs.divergence, 'uVelocity', velocity.read.tex, 0)
    blit(divergence)

    // pressure solve (Jacobi)
    gl.useProgram(progs.pressure)
    gl.uniform2f(uni(progs.pressure, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    bindTex(progs.pressure, 'uDivergence', divergence.tex, 0)
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      bindTex(progs.pressure, 'uPressure', pressure.read.tex, 1)
      blit(pressure.write)
      pressure.swap()
    }

    // subtract gradient
    gl.useProgram(progs.gradient)
    gl.uniform2f(uni(progs.gradient, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    bindTex(progs.gradient, 'uPressure', pressure.read.tex, 0)
    bindTex(progs.gradient, 'uVelocity', velocity.read.tex, 1)
    blit(velocity.write)
    velocity.swap()

    // advect velocity
    gl.useProgram(progs.advection)
    gl.uniform2f(uni(progs.advection, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    gl.uniform1f(uni(progs.advection, 'dt'), DT)
    gl.uniform1f(uni(progs.advection, 'dissipation'), tuning.velocityDissipation)
    bindTex(progs.advection, 'uVelocity', velocity.read.tex, 0)
    bindTex(progs.advection, 'uSource', velocity.read.tex, 1)
    blit(velocity.write)
    velocity.swap()

    // advect dye (velocity is coarser, so use its texel size for the lookup)
    gl.useProgram(progs.advection)
    gl.uniform2f(uni(progs.advection, 'texelSize'), velocity.read.texelX, velocity.read.texelY)
    gl.uniform1f(uni(progs.advection, 'dt'), DT)
    gl.uniform1f(uni(progs.advection, 'dissipation'), tuning.densityDissipation)
    bindTex(progs.advection, 'uVelocity', velocity.read.tex, 0)
    bindTex(progs.advection, 'uSource', dye.read.tex, 1)
    blit(dye.write)
    dye.swap()
  }

  const render = (): void => {
    gl.useProgram(progs.display)
    gl.uniform2f(uni(progs.display, 'texelSize'), dye.read.texelX, dye.read.texelY)
    bindTex(progs.display, 'uTexture', dye.read.tex, 0)
    gl.uniform3f(uni(progs.display, 'paper'), pr, pg, pb)
    gl.uniform3f(uni(progs.display, 'ink'), ir, ig, ib)
    blit(null)
  }

  const totalSteps = Math.max(1, Math.round(FLUID_MS / (DT * 1000)))

  const cleanup = (): void => {
    canvas.remove()
    const ext = gl.getExtension('WEBGL_lose_context')
    ext?.loseContext()
  }

  const bake = (): HTMLCanvasElement => {
    render()
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    out.getContext('2d')!.drawImage(canvas, 0, 0)
    cleanup()
    return out
  }

  return new Promise<HTMLCanvasElement>((resolve, reject) => {
    if (signal?.aborted) {
      cleanup()
      reject(new DOMException('aborted', 'AbortError'))
      return
    }

    if (!animate) {
      for (let i = 0; i < totalSteps; i++) step()
      resolve(bake())
      return
    }

    let done = 0
    let raf = 0
    const onAbort = (): void => {
      if (raf) cancelAnimationFrame(raf)
      cleanup()
      reject(new DOMException('aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })

    const frame = (): void => {
      step()
      render()
      done++
      if (done >= totalSteps) {
        signal?.removeEventListener('abort', onAbort)
        resolve(bake())
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  })
}
