// childAuth.* — the device-login/PIN/changePassword/device-picker surface
// (plan §5.1). A factory: it injects `deps.hasher` (verify a password/PIN —
// node:crypto, browser-unsafe) and `deps.mintChildToken` (the token-minting
// port, plan §5.2), like children.ts.
//
// IMPORTANT ownership/identity note: these are the CHILD-auth procedures —
// they run BEFORE a child session exists (login) or to bootstrap one, so they
// are PUBLIC (no requireParent / no child session yet). They must NOT trust
// any parentId from input; identity is proven against the Store from the
// input credentials instead. On successful login, the handler mints a signed
// child token via `deps.mintChildToken` and returns it — setting it as the
// `CHILD_SESSION_COOKIE` (auth/providers.ts) is a P5/transport decision.
//
// The signing secret and node:crypto live behind the `mintChildToken` seam
// (router/deps.ts + auth/childTokenPort.ts): the composition root closes the
// concrete Node minter over `CHILD_SESSION_SECRET`, so neither this file nor
// the handler graph touches `process.env` or crypto — the same DI seam
// `PasswordHasher` uses for password.ts, which keeps node:crypto out of the
// browser `.iwft` bundle.
import {
  ChangePasswordHandler,
  changePasswordInputSchema,
} from '../handlers/childAuth/changePasswordHandler.ts'
import {
  DeviceChildrenHandler,
  deviceChildrenInputSchema,
} from '../handlers/childAuth/deviceChildrenHandler.ts'
import {
  LoginPasswordHandler,
  loginPasswordInputSchema,
} from '../handlers/childAuth/loginPasswordHandler.ts'
import { LoginPinHandler, loginPinInputSchema } from '../handlers/childAuth/loginPinHandler.ts'
import type { RouterDeps } from './deps.ts'
import { publicProcedure, router } from './trpc.ts'

// A factory (not a const) so the composition root injects the PasswordHasher
// (verify/hash a password/PIN — node:crypto, browser-unsafe) and the
// child-token minter (node:crypto + the signing secret), same reason as
// children.ts.
export function createChildAuthRouter(deps: RouterDeps) {
  return router({
    loginPassword: publicProcedure
      .input(loginPasswordInputSchema)
      .mutation(({ input, ctx }) =>
        new LoginPasswordHandler({
          hasher: deps.hasher,
          mintChildToken: deps.mintChildToken,
        }).run(input, ctx),
      ),
    loginPin: publicProcedure
      .input(loginPinInputSchema)
      .mutation(({ input, ctx }) =>
        new LoginPinHandler({ hasher: deps.hasher, mintChildToken: deps.mintChildToken }).run(
          input,
          ctx,
        ),
      ),
    changePassword: publicProcedure
      .input(changePasswordInputSchema)
      .mutation(({ input, ctx }) =>
        new ChangePasswordHandler({ hasher: deps.hasher }).run(input, ctx),
      ),
    deviceChildren: publicProcedure
      .input(deviceChildrenInputSchema)
      .query(({ input, ctx }) => new DeviceChildrenHandler().run(input, ctx)),
  })
}
