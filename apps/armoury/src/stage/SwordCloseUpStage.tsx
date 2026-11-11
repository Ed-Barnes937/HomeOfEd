import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

import { compileSword } from '../sword/compile.ts'
import { reach } from '../sword/geometry.ts'
import { HeldRig, type HeldItem } from './HeldRig.tsx'
import { MM } from './scene.tsx'
import {
  boxScale,
  SmithyEffects,
  SmithyEnvironment,
  SmithyLights,
  SMITHY_RIM,
  SWORD_HALF_WIDTH,
} from './smithyScene.tsx'
import type { CloseUpProps } from './stage.ts'
import { FLOURISH_SCALE, presentWeight } from './swordGlow.ts'
import { SwordMesh, swordTipPoint } from './SwordMesh.tsx'

// Dev-only, for the GPU gate shots: `?focus=tip` or `?focus=hilt` slides the sword along so a zoom lands there.
const FOCUS: Record<string, number> = { tip: -0.4, hilt: 0.3 }
const focus =
  import.meta.env.DEV && typeof location !== 'undefined'
    ? (FOCUS[new URLSearchParams(location.search).get('focus') ?? ''] ?? 0)
    : 0

// Dev-only, for the GPU gate shots: publishes how long ago the latest flourish began, on the stage's own clock.
const PROBE = import.meta.env.DEV

function FlourishProbe({ at }: { at: number | null }) {
  useFrame(({ clock }) => {
    Object.assign(window, { sinceFlourish: at === null ? null : clock.elapsedTime - at })
  })
  return null
}

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
/** How quickly the blade turns its flat to the viewer, per second, once fully presenting. */
const PRESENT_RATE = 5

/**
 * Rolls the sword about its length so a flat faces the viewer through the glint and the wake,
 * whichever way the child or the idle roll left it; the roll it adds is kept afterwards, so nothing turns back.
 */
function Presented({
  flourishAt,
  reducedMotion,
  children,
}: {
  flourishAt: number | null
  reducedMotion: boolean
  children: ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  const v = useMemo(
    () => ({
      held: new THREE.Quaternion(),
      at: new THREE.Vector3(),
      length: new THREE.Vector3(),
      flat: new THREE.Vector3(),
      view: new THREE.Vector3(),
      cross: new THREE.Vector3(),
    }),
    [],
  )
  useFrame(({ clock, camera }, delta) => {
    const g = group.current
    if (!g?.parent || flourishAt === null) return
    const weight = presentWeight(clock.elapsedTime - flourishAt, reducedMotion)
    if (weight <= 0) return
    g.parent.getWorldQuaternion(v.held)
    g.getWorldPosition(v.at)
    v.length.copy(X).applyQuaternion(v.held)
    v.flat.copy(Y).applyAxisAngle(X, g.rotation.x).applyQuaternion(v.held)
    v.view.copy(camera.position).sub(v.at)
    v.view.addScaledVector(v.length, -v.view.dot(v.length))
    if (v.view.lengthSq() < 1e-6) return
    v.view.normalize()
    let turn = Math.atan2(v.cross.crossVectors(v.flat, v.view).dot(v.length), v.flat.dot(v.view))
    // Either face will do: turn to the nearer.
    if (Math.abs(turn) > Math.PI / 2) turn -= Math.sign(turn) * Math.PI
    g.rotation.x += turn * weight * (1 - Math.exp(-PRESENT_RATE * Math.min(delta, 0.05)))
  })
  return <group ref={group}>{children}</group>
}

/** The close look: the sword lifts off the anvil, flourishes, glints up its edge, wakes its runes, and goes back. */
export function SwordCloseUpStage({ params, reducedMotion, ...rig }: CloseUpProps) {
  const spec = useMemo(() => compileSword(params), [params])
  const item = useMemo((): HeldItem => {
    const [across, through] = reach(spec)
    // Generous round a slim blade so a tap on it lands.
    const girth = Math.max(across * 2, 30) * MM
    return {
      lengthMm: spec.lengthMm,
      tip: swordTipPoint(spec),
      hit: [spec.lengthMm * MM * 1.05, Math.max(through * 2, 30) * MM, girth],
      grip: spec.gripAt,
      flourishScale: FLOURISH_SCALE,
      trailColour: null,
      boxHalfWidth: SWORD_HALF_WIDTH / boxScale(spec.lengthMm),
    }
  }, [spec])

  return (
    <HeldRig
      {...rig}
      item={item}
      reducedMotion={reducedMotion}
      Lights={SmithyLights}
      rimIntensity={SMITHY_RIM}
      environment={<SmithyEnvironment />}
      effects={<SmithyEffects />}
    >
      {(flourishAt) => (
        <Presented flourishAt={flourishAt} reducedMotion={reducedMotion}>
          <group position={[focus * spec.lengthMm * MM, 0, 0]}>
            <SwordMesh spec={spec} flourishAt={flourishAt} reducedMotion={reducedMotion} />
            {PROBE && <FlourishProbe at={flourishAt} />}
          </group>
        </Presented>
      )}
    </HeldRig>
  )
}
