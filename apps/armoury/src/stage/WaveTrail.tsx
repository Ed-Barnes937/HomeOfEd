import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'

import { glowMaterial } from './glow.ts'

const COUNT = 2048
const LIFE_SECONDS = 1.8
const PER_FRAME = 4

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aBirth;
  varying float vAlpha;
  void main() {
    float life = clamp(1.0 - (uTime - aBirth) / ${LIFE_SECONDS.toFixed(2)}, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.3 + 0.7 * life) / -mv.z;
    vAlpha = life * life;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float strength = clamp(0.05 / max(d, 0.04) - 0.1, 0.0, 1.0);
    gl_FragColor = vec4(uColor * 2.0, strength * vAlpha);
  }
`

/** A streak of light left in the air behind the tip while `emitting`, so a wave's shape shows. */
export function WaveTrail({
  colour,
  tip,
  emitting,
}: {
  colour: string
  /** The tip's position in world space, kept current by whoever moves the wand. */
  tip: RefObject<THREE.Vector3>
  emitting: RefObject<boolean>
}) {
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
    g.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(COUNT).fill(-10), 1))
    return g
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 60 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color() },
    }),
    [],
  )
  const material = useMemo(() => glowMaterial(uniforms, vertexShader, fragmentShader), [uniforms])
  useEffect(() => () => material.dispose(), [material])

  const trail = useMemo(() => ({ next: 0, last: null as THREE.Vector3 | null }), [])

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uPixelRatio.value = dpr
    uniforms.uColor.value.set(colour)
    if (!emitting.current) {
      trail.last = null
      return
    }
    const position = geometry.getAttribute('position') as THREE.BufferAttribute
    const birth = geometry.getAttribute('aBirth') as THREE.BufferAttribute
    const from = trail.last ?? tip.current
    // Fill in between frames so a fast flick still leaves an unbroken line.
    for (let i = 1; i <= PER_FRAME; i++) {
      const k = trail.next
      const t = i / PER_FRAME
      position.setXYZ(
        k,
        THREE.MathUtils.lerp(from.x, tip.current.x, t),
        THREE.MathUtils.lerp(from.y, tip.current.y, t),
        THREE.MathUtils.lerp(from.z, tip.current.z, t),
      )
      birth.setX(k, clock.elapsedTime)
      trail.next = (k + 1) % COUNT
    }
    position.needsUpdate = birth.needsUpdate = true
    trail.last = (trail.last ?? new THREE.Vector3()).copy(tip.current)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
