import type { BlobStore } from './blobs.ts'
import type { Logger } from './logger.ts'

/** Extensible per app via intersection. */
export type User = { id: string }

export interface AuthProvider {
  getUser(): User | null
}

/**
 * The single tRPC context — the DI seam. Generic over the app's own Store
 * interface; handlers depend on this and nothing concrete.
 */
export interface AppContext<Store> {
  store: Store
  blobs: BlobStore
  auth: AuthProvider
  now(): Date
  logger: Logger
}

export interface CreateContextDeps<Store> {
  store: Store
  blobs: BlobStore
  logger: Logger
  now?: () => Date
  /** Auth seam: derive the auth provider from the request. Defaults to anonymous. */
  auth?: (req: Request) => AuthProvider
}

const anonymous: AuthProvider = { getUser: () => null }

/**
 * Store-injection seam: close over the app's singletons, return tRPC's
 * PER-REQUEST context factory. All three transports (Vite middleware,
 * in-browser dispatch, createAppServer) call the returned function.
 */
export function createContext<Store>(
  deps: CreateContextDeps<Store>,
): (req: Request) => AppContext<Store> {
  const now = deps.now ?? (() => new Date())
  const auth = deps.auth ?? (() => anonymous)
  return (req: Request): AppContext<Store> => ({
    store: deps.store,
    blobs: deps.blobs,
    logger: deps.logger,
    now,
    auth: auth(req),
  })
}
