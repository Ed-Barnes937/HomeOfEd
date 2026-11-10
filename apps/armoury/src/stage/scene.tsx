import type { Ref } from 'react'
import type { DirectionalLight } from 'three'

/** Scene units per mm: a 33cm wand is 3.3 units long. */
export const MM = 0.01

export const FOV = 26
/** The box's camera sits this far towards the viewer, as a fraction of its height, to see a little of the wand's side. */
export const BOX_CAMERA_LEAN = 0.12

export const RIM_INTENSITY = 0.9

/** A warm key from the upper left and a cool rim from behind, in the box's frame. */
export function ShopLights({ rim }: { rim?: Ref<DirectionalLight> }) {
  return (
    <>
      <directionalLight position={[-1.5, 3, 2]} intensity={2.4} color="#ffe2b8" />
      <directionalLight
        ref={rim}
        position={[0.5, 1, -3]}
        intensity={RIM_INTENSITY}
        color="#cfd8ff"
      />
    </>
  )
}
