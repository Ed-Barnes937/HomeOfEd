import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { SiteHeader } from './components/SiteHeader.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { WotdPage } from './pages/WotdPage.tsx'
import { DIFFICULTIES, type Difficulty } from './server/wordGenerator.ts'

function RootLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  )
}

const rootRoute = createRootRoute({ component: RootLayout })

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
