export const FOV = 26
/** The box's camera sits this far towards the viewer, as a fraction of its height, to see a little of the wand's side. */
export const BOX_CAMERA_LEAN = 0.12

/** A warm key from the upper left and a cool rim from behind, in the box's frame. */
export function ShopLights() {
  return (
    <>
      <directionalLight position={[-1.5, 3, 2]} intensity={2.4} color="#ffe2b8" />
      <directionalLight position={[0.5, 1, -3]} intensity={0.9} color="#cfd8ff" />
    </>
  )
}
