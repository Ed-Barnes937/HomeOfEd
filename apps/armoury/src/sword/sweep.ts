// The one mesh primitive every sword part uses: a closed section carried along a
// path. Pure and three-free; every swept part is its own closed manifold.

export type Vec3 = [number, number, number]

export interface Station {
  centre: Vec3
  axisU: Vec3
  axisV: Vec3
  /** N (u, v) pairs, mm, in the frame of axisU and axisV. Ignored on an apex end. */
  section: Float32Array
  /** Texture coordinate along the part, mm. */
  uvAlong: number
  /** Optional per-column values (N each), carried onto the part's attrs. */
  attrs?: Record<string, Float32Array>
  /** Optional exact surface normals, N (u, v, along) triples, along being axisU x axisV; they replace the computed ones on this ring. */
  normals?: Float32Array
}

export interface MeshPart {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  indices: Uint32Array
  attrs: Record<string, Float32Array>
}

/** `fan`: a flat cap with its own vertices, for an outline star-shaped about the centre. `apex`: the end station closes to its centre. */
export type Cap = 'fan' | 'apex'

export interface SweepOptions {
  capStart: Cap
  capEnd: Cap
  /** Duplicate the first column so uv across runs round the perimeter (a lathe part); otherwise uv across is the section's u. */
  seam: boolean
}

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

function signedArea(section: Float32Array): number {
  const n = section.length / 2
  let a = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    a += section[i * 2]! * section[j * 2 + 1]! - section[j * 2]! * section[i * 2 + 1]!
  }
  return a / 2
}

const mean = (values: Float32Array | undefined) => {
  if (!values || values.length === 0) return 0
  let s = 0
  for (const v of values) s += v
  return s / values.length
}

/** Lays the stations' sections into rings, joins them and caps both ends. */
export function sweep(stations: Station[], opts: SweepOptions): MeshPart {
  const last = stations.length - 1
  const isApex = (j: number) =>
    (j === 0 && opts.capStart === 'apex') || (j === last && opts.capEnd === 'apex')
  const ringStation = stations.find((_, j) => !isApex(j))!
  const N = ringStation.section.length / 2
  const cols = N + (opts.seam ? 1 : 0)
  const keys = Object.keys(stations.find((s) => s.attrs)?.attrs ?? {})

  // Wind so faces point out of the solid, whichever way the section runs.
  const ringIndex = stations.indexOf(ringStation)
  const other = stations[ringIndex === last ? ringIndex - 1 : ringIndex + 1]!
  const ahead = ringStation.centre.map(
    (c, k) => (other.centre[k]! - c) * (ringIndex === last ? -1 : 1),
  ) as Vec3
  const facing = cross(ringStation.axisU, ringStation.axisV)
  const flip =
    signedArea(ringStation.section) *
      (facing[0] * ahead[0] + facing[1] * ahead[1] + facing[2] * ahead[2]) <
    0

  const capVerts = (cap: Cap) => (cap === 'fan' ? N + 1 : 0)
  let count = capVerts(opts.capStart) + capVerts(opts.capEnd)
  for (let j = 0; j <= last; j++) count += isApex(j) ? 1 : cols
  const positions = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const attrs: Record<string, Float32Array> = {}
  for (const key of keys) attrs[key] = new Float32Array(count)

  let v = 0
  const put = (s: Station, u: number, w: number, uvU: number, uvV: number) => {
    const { centre: c, axisU: a, axisV: b } = s
    positions[v * 3] = c[0] + u * a[0] + w * b[0]
    positions[v * 3 + 1] = c[1] + u * a[1] + w * b[1]
    positions[v * 3 + 2] = c[2] + u * a[2] + w * b[2]
    uvs[v * 2] = uvU
    uvs[v * 2 + 1] = uvV
    return v++
  }
  const setAttrs = (vertex: number, s: Station, col: number | null, fallback?: Station) => {
    for (const key of keys) {
      const values = s.attrs?.[key]
      attrs[key]![vertex] =
        col !== null && values && values.length > col
          ? values[col]!
          : mean(values && values.length > 0 ? values : fallback?.attrs?.[key])
    }
  }

  const ringStart: number[] = []
  for (let j = 0; j <= last; j++) {
    const s = stations[j]!
    if (isApex(j)) {
      ringStart.push(put(s, 0, 0, 0, s.uvAlong))
      setAttrs(ringStart[j]!, s, null, stations[j === 0 ? 1 : j - 1])
      continue
    }
    ringStart.push(v)
    let around = 0
    for (let i = 0; i < cols; i++) {
      const c = i % N
      const u = s.section[c * 2]!
      const w = s.section[c * 2 + 1]!
      if (i > 0) {
        const p = (i - 1) % N
        around += Math.hypot(u - s.section[p * 2]!, w - s.section[p * 2 + 1]!)
      }
      setAttrs(put(s, u, w, opts.seam ? around : u, s.uvAlong), s, c)
    }
  }

  const tris = new Uint32Array((last * 2 + 2) * N * 3)
  let used = 0
  const tri = (a: number, b: number, c: number) => {
    if (a === b || b === c || a === c) return
    tris[used++] = a
    tris[used++] = flip ? c : b
    tris[used++] = flip ? b : c
  }
  const next = (i: number) => (opts.seam ? i + 1 : (i + 1) % N)
  const at = (j: number, i: number) => (isApex(j) ? ringStart[j]! : ringStart[j]! + i)
  for (let j = 0; j < last; j++)
    for (let i = 0; i < N; i++) {
      const a = at(j, i)
      const b = at(j, next(i))
      const c = at(j + 1, next(i))
      const d = at(j + 1, i)
      tri(a, b, c)
      tri(a, c, d)
    }

  const fan = (j: number, start: boolean) => {
    const s = stations[j]!
    const base = v
    for (let i = 0; i < N; i++)
      setAttrs(put(s, s.section[i * 2]!, s.section[i * 2 + 1]!, s.section[i * 2]!, s.uvAlong), s, i)
    const centre = put(s, 0, 0, 0, s.uvAlong)
    setAttrs(centre, s, null)
    for (let i = 0; i < N; i++) {
      const i1 = (i + 1) % N
      if (start) tri(centre, base + i1, base + i)
      else tri(base + i, base + i1, centre)
    }
  }
  if (opts.capStart === 'fan') fan(0, true)
  if (opts.capEnd === 'fan') fan(last, false)

  const part: MeshPart = {
    positions,
    normals: new Float32Array(count * 3),
    uvs,
    indices: tris.slice(0, used),
    attrs,
  }
  computeNormals(part)
  stations.forEach((st, j) => {
    if (!st.normals || isApex(j)) return
    const [a0, a1, a2] = st.axisU
    const [b0, b1, b2] = st.axisV
    const [t0, t1, t2] = cross(st.axisU, st.axisV)
    for (let i = 0; i < cols; i++) {
      const c = (i % N) * 3
      const [a, b, n] = [st.normals[c]!, st.normals[c + 1]!, st.normals[c + 2]!]
      const x = a * a0 + b * b0 + n * t0
      const y = a * a1 + b * b1 + n * t1
      const z = a * a2 + b * b2 + n * t2
      const len = Math.hypot(x, y, z)
      const k = (ringStart[j]! + i) * 3
      part.normals[k] = x / len
      part.normals[k + 1] = y / len
      part.normals[k + 2] = z / len
    }
  })
  return part
}

/** Concatenates parts; an attribute missing from a part is 0 there. */
export function merge(parts: MeshPart[]): MeshPart {
  const keys = [...new Set(parts.flatMap((p) => Object.keys(p.attrs)))]
  const verts = parts.reduce((n, p) => n + p.positions.length / 3, 0)
  const tris = parts.reduce((n, p) => n + p.indices.length, 0)
  const out: MeshPart = {
    positions: new Float32Array(verts * 3),
    normals: new Float32Array(verts * 3),
    uvs: new Float32Array(verts * 2),
    indices: new Uint32Array(tris),
    attrs: Object.fromEntries(keys.map((k) => [k, new Float32Array(verts)])),
  }
  let v = 0
  let t = 0
  for (const p of parts) {
    out.positions.set(p.positions, v * 3)
    out.normals.set(p.normals, v * 3)
    out.uvs.set(p.uvs, v * 2)
    for (const k of keys) if (p.attrs[k]) out.attrs[k]!.set(p.attrs[k], v)
    for (let i = 0; i < p.indices.length; i++) out.indices[t + i] = p.indices[i]! + v
    v += p.positions.length / 3
    t += p.indices.length
  }
  return out
}

/** Angle-weighted vertex normals from the triangles; run after any bend. */
export function computeNormals(part: MeshPart): void {
  const { positions: p, indices } = part
  const acc = new Float64Array(p.length)
  for (let t = 0; t < indices.length; t += 3) {
    const ia = indices[t]! * 3
    const ib = indices[t + 1]! * 3
    const ic = indices[t + 2]! * 3
    const abx = p[ib]! - p[ia]!
    const aby = p[ib + 1]! - p[ia + 1]!
    const abz = p[ib + 2]! - p[ia + 2]!
    const acx = p[ic]! - p[ia]!
    const acy = p[ic + 1]! - p[ia + 1]!
    const acz = p[ic + 2]! - p[ia + 2]!
    const bcx = p[ic]! - p[ib]!
    const bcy = p[ic + 1]! - p[ib + 1]!
    const bcz = p[ic + 2]! - p[ib + 2]!
    const fx = aby * acz - abz * acy
    const fy = abz * acx - abx * acz
    const fz = abx * acy - aby * acx
    const len = Math.hypot(fx, fy, fz)
    if (len === 0) continue
    // Twice the area is the same cross product at every corner, so each angle is atan2(len, dot).
    const wa = Math.atan2(len, abx * acx + aby * acy + abz * acz) / len
    const wb = Math.atan2(len, -(abx * bcx + aby * bcy + abz * bcz)) / len
    const wc = Math.atan2(len, acx * bcx + acy * bcy + acz * bcz) / len
    acc[ia] = acc[ia]! + fx * wa
    acc[ia + 1] = acc[ia + 1]! + fy * wa
    acc[ia + 2] = acc[ia + 2]! + fz * wa
    acc[ib] = acc[ib]! + fx * wb
    acc[ib + 1] = acc[ib + 1]! + fy * wb
    acc[ib + 2] = acc[ib + 2]! + fz * wb
    acc[ic] = acc[ic]! + fx * wc
    acc[ic + 1] = acc[ic + 1]! + fy * wc
    acc[ic + 2] = acc[ic + 2]! + fz * wc
  }
  for (let k = 0; k < acc.length; k += 3) {
    const len = Math.hypot(acc[k]!, acc[k + 1]!, acc[k + 2]!)
    if (len === 0) {
      part.normals[k] = 0
      part.normals[k + 1] = 0
      part.normals[k + 2] = 1
    } else {
      part.normals[k] = acc[k]! / len
      part.normals[k + 1] = acc[k + 1]! / len
      part.normals[k + 2] = acc[k + 2]! / len
    }
  }
}

// Mesh checks, shared by the sword's unit tests.

/** Edges not shared by exactly two oppositely wound triangles, after welding vertices at identical positions. */
export function openEdges(part: MeshPart): number {
  const ids = new Map<string, number>()
  const p = part.positions
  const weld: number[] = []
  for (let k = 0; k < p.length / 3; k++) {
    const key = `${p[k * 3]},${p[k * 3 + 1]},${p[k * 3 + 2]}`
    if (!ids.has(key)) ids.set(key, ids.size)
    weld.push(ids.get(key)!)
  }
  // Directed edge a>b as one number; welded ids stay far below 2^26.
  const edges = new Map<number, number>()
  const SHIFT = 2 ** 26
  let bad = 0
  const { indices } = part
  for (let t = 0; t < indices.length; t += 3) {
    const a = weld[indices[t]!]!
    const b = weld[indices[t + 1]!]!
    const c = weld[indices[t + 2]!]!
    if (a === b || b === c || a === c) {
      bad++
      continue
    }
    for (const key of [a * SHIFT + b, b * SHIFT + c, c * SHIFT + a])
      edges.set(key, (edges.get(key) ?? 0) + 1)
  }
  for (const [key, n] of edges) {
    const a = Math.floor(key / SHIFT)
    const b = key - a * SHIFT
    if (n !== 1 || edges.get(b * SHIFT + a) !== 1) bad++
  }
  return bad
}

export function signedVolume(part: MeshPart): number {
  const { positions: p, indices } = part
  let v = 0
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]! * 3
    const b = indices[t + 1]! * 3
    const c = indices[t + 2]! * 3
    v +=
      p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!) -
      p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!) +
      p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)
  }
  return v / 6
}

/** Vertices with a non-unit or non-finite normal, plus triangle corners whose normal faces away from the triangle. */
export function inwardNormals(part: MeshPart): number {
  const { positions: p, normals: n, indices } = part
  let bad = 0
  for (let k = 0; k < n.length; k += 3) {
    const len = Math.hypot(n[k]!, n[k + 1]!, n[k + 2]!)
    if (!Number.isFinite(len) || Math.abs(len - 1) > 1e-4) bad++
    if (!Number.isFinite(p[k]! + p[k + 1]! + p[k + 2]!)) bad++
  }
  for (let t = 0; t < indices.length; t += 3) {
    const vs = [indices[t]! * 3, indices[t + 1]! * 3, indices[t + 2]! * 3] as const
    const [a, b, c] = vs
    const face = cross(
      [p[b]! - p[a]!, p[b + 1]! - p[a + 1]!, p[b + 2]! - p[a + 2]!],
      [p[c]! - p[a]!, p[c + 1]! - p[a + 1]!, p[c + 2]! - p[a + 2]!],
    )
    if (Math.hypot(...face) < 1e-9) continue
    for (const k of vs) if (face[0] * n[k]! + face[1] * n[k + 1]! + face[2] * n[k + 2]! <= 0) bad++
  }
  return bad
}
