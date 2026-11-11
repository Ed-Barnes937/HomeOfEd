import { Component, Suspense, type ReactNode } from 'react'

/**
 * Where a scene's stage loads: if its chunk, a texture or a map fails, the slot stays empty and
 * the rest of the shop keeps working, instead of the router's error page replacing it.
 */
export class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) return null
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}
