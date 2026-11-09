import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { glowMaterial } from './glow.ts'
import { SPELL_SECONDS } from './stage.ts'

const DURATION = SPELL_SECONDS

// Each spark flies out of the tip on its own velocity, slows, drifts down a
// little and fades. `uAge` is seconds since the cast; past DURATION nothing draws.
const vertexShader = /* glsl */ `
  uniform float uAge;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aVelocity;
  attribute float aDelay;
  varying float vAlpha;
  void main() {
    float t = max(uAge - aDelay, 0.0);
    float travel = (1.0 - exp(-2.2 * t)) / 2.2;
    vec3 p = aVelocity * travel + vec3(0.0, 0.0, 0.12 * t * t);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float life = clamp(1.0 - t / ${DURATION.toFixed(1)}, 0.0, 1.0);
    vAlpha = uAge > aDelay ? life * life : 0.0;
    gl_PointSize = uSize * uPixelRatio * (0.5 + 0.5 * life) / -mv.z;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float strength = clamp(0.06 / max(d, 0.04) - 0.12, 0.0, 1.0);
    gl_FragColor = vec4(uColor * 2.4, strength * vAlpha);
  }
`

export function SpellBurst({
  colour,
  castAt,
  count = 140,
}: {
  colour: string
  /** Clock time of the latest cast, or null before the first. */
  castAt: number | null
  count?: number
}) {
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const velocities = new Float32Array(count * 3)
    const delays = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // A starburst leaning out of the tip (+x), sized to stay inside the stage's bleed.
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const speed = 0.4 + Math.random() * 1.0
      velocities.set(
        [(r * Math.cos(a) + 0.45) * speed, u * speed * 0.6, r * Math.sin(a) * speed * 0.75],
        i * 3,
      )
      delays[i] = Math.random() * 0.25
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    g.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3))
    g.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4)
    return g
  }, [count])

  const uniforms = useMemo(
    () => ({
      uAge: { value: DURATION * 2 },
      uSize: { value: 90 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color() },
    }),
    [],
  )

  const material = useMemo(() => glowMaterial(uniforms, vertexShader, fragmentShader), [uniforms])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock }) => {
    uniforms.uAge.value = castAt === null ? DURATION * 2 : clock.elapsedTime - castAt
    uniforms.uPixelRatio.value = dpr
    uniforms.uColor.value.set(colour)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}
