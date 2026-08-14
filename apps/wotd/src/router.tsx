import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'

import { HomePage } from './pages/HomePage.tsx'
import { WotdPage } from './pages/WotdPage.tsx'
import { DIFFICULTIES, type Difficulty } from './server/wordGenerator.ts'

// Each page renders its own top bar — the picker's SiteHeader and the word
// screen's WordHeader differ in the design (frames 5a/5d vs 5b/5e).
const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

/** Invalid/absent `level` falls back to 'beginner'. No zod — plain validator. */
function validateSearch(search: Record<string, unknown>): { level: Difficulty } {
  return {
    level: (DIFFICULTIES as readonly string[]).includes(search.level as string)
      ? (search.level as Difficulty)
      : 'beginner',
  }
}

const wotdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wotd',
  component: WotdPage,
  validateSearch,
})

const routeTree = rootRoute.addChildren([indexRoute, wotdRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
