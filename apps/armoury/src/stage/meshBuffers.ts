// What every generated mesh's stage shares: rebuilding only the latest spec once a frame, and
// refilling GPU buffers in place when a rebuild has the same sizes.
import * as THREE from 'three'

import type { MeshPart } from '../sword/sweep.ts'

export interface FrameScheduler {
  request(run: () => void): unknown
  cancel(handle: unknown): void
}

export const animationFrames: FrameScheduler = {
  request: (run) => requestAnimationFrame(run),
  cancel: (handle) => cancelAnimationFrame(handle as number),
}

/** Builds only the latest input, once, on the next frame: a slider dragged across a frame costs one build. */
export function latestOnly<I, O>(
  build: (input: I) => O,
  built: (output: O) => void,
  frames = animationFrames,
) {
  let latest: { input: I } | null = null
  let handle: unknown = null
  return {
    request(input: I) {
      latest = { input }
      if (handle !== null) return
      handle = frames.request(() => {
        handle = null
        const next = latest
        latest = null
        if (next) built(build(next.input))
      })
    },
    cancel() {
      if (handle !== null) frames.cancel(handle)
      handle = null
      latest = null
    },
  }
}

/** Copies a part into `geometry` when its buffers are the same size, else replaces it. */
export function fillGeometry(
  geometry: THREE.BufferGeometry | null,
  part: MeshPart,
  extra: Record<string, { array: Float32Array; size: number }> = {},
): THREE.BufferGeometry {
  const attrs: Record<string, { array: Float32Array; size: number }> = {
    position: { array: part.positions, size: 3 },
    normal: { array: part.normals, size: 3 },
    uv: { array: part.uvs, size: 2 },
    ...Object.fromEntries(Object.entries(part.attrs).map(([k, array]) => [k, { array, size: 1 }])),
    ...extra,
  }
  const index = geometry?.getIndex()
  const fits =
    geometry !== null &&
    index?.array.length === part.indices.length &&
    Object.entries(attrs).every(
      ([k, a]) => geometry.getAttribute(k)?.array.length === a.array.length,
    ) &&
    Object.keys(geometry.attributes).length === Object.keys(attrs).length
  if (fits) {
    for (const [k, a] of Object.entries(attrs)) {
      const attribute = geometry.getAttribute(k) as THREE.BufferAttribute
      ;(attribute.array as Float32Array).set(a.array)
      attribute.needsUpdate = true
    }
    ;(index.array as Uint32Array).set(part.indices)
    index.needsUpdate = true
    geometry.computeBoundingSphere()
    return geometry
  }
  geometry?.dispose()
  const g = new THREE.BufferGeometry()
  for (const [k, a] of Object.entries(attrs))
    g.setAttribute(k, new THREE.BufferAttribute(a.array, a.size))
  g.setIndex(new THREE.BufferAttribute(part.indices, 1))
  return g
}
