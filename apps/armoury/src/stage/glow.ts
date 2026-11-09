import * as THREE from 'three'

/**
 * An additive point material that keeps `uniforms` as its own, so writing a
 * value each frame reaches the GPU. R3F's `<shaderMaterial uniforms>` copies
 * each uniform on mount, which leaves numbers frozen at their first value.
 */
export function glowMaterial(
  uniforms: Record<string, THREE.IUniform>,
  vertexShader: string,
  fragmentShader: string,
) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}
