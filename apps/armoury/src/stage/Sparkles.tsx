import { useFrame, useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'

// Our own sparkles rather than drei's: its shader divides by the distance to
// the sprite centre, which is infinite when a pixel lands exactly on it, and
// bloom smears that infinity into a blank frame.

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute float aPhase;
  varying float vAlpha;
  void main() {
    float t = uTime * 0.5 + aPhase * 6.2832;
    vec3 p = position + vec3(sin(t * 1.3) * 0.02, sin(t) * 0.04, cos(t * 0.9) * 0.02);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio / -mv.z;
    vAlpha = 0.55 + 0.45 * sin(uTime * 2.3 + aPhase * 17.0);
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

export function Sparkles({
  colour,
  count = 40,
  radius = 0.18,
}: {
  colour: string
  count?: number
  radius?: number
}) {
  const dpr = useThree((s) => s.viewport.dpr)

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      // Uniform in a sphere.
      const u = Math.random() * 2 - 1
      const a = Math.random() * Math.PI * 2
      const r = radius * Math.cbrt(Math.random())
      const s = Math.sqrt(1 - u * u)
      positions.set([r * s * Math.cos(a), r * s * Math.sin(a), r * u], i * 3)
      phases[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
    return g
  }, [count, radius])

  // One uniforms object for the material's lifetime; values are updated in
  // place, because swapping the object doesn't reach a compiled material.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 70 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color() },
    }),
    [],
  )

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime
    uniforms.uPixelRatio.value = dpr
    uniforms.uColor.value.set(colour)
  })

  return (
    <points geometry={geometry}>
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}
