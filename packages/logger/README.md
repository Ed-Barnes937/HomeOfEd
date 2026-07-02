# @hoe/logger

Structured JSON logging. Zero runtime dependencies; implements the
T1.1-frozen `Logger` interface from `@hoe/backend-kit` (type-only import).

## Usage

```ts
import { createLogger, requestLogger } from '@hoe/logger'

const logger = createLogger()               // level from LOG_LEVEL, else 'info'
// const logger = createLogger({ level: 'debug' })

logger.info('server started', { port: 3000 })
// {"level":"info","msg":"server started","time":"2026-07-02T09:00:00.000Z","port":3000}

const scoped = logger.child({ app: 'hub' }) // bindings appear on every line
scoped.warn('slow query', { durationMs: 132 })
```

## Line format

One JSON object per line, all levels to **stdout** (including `error` — a
single stream keeps ordering, and Fly's log drain treats stdout/stderr the
same).

| Field    | Meaning                                              |
| -------- | ---------------------------------------------------- |
| `level`  | `debug` \| `info` \| `warn` \| `error`               |
| `msg`    | the log message                                      |
| `time`   | ISO 8601 timestamp                                   |
| ...rest  | merged `child()` bindings, then per-call fields      |

Per-call fields override bindings of the same name. `level`, `msg` and `time`
are reserved and cannot be overridden by fields or bindings.

## Levels

`debug < info < warn < error`. Lines below the minimum level are dropped. The
minimum comes from `createLogger({ level })`, else the `LOG_LEVEL` env var
(read once, at `createLogger` time), else `info`. Invalid values fall back to
`info`.

## Redaction

Values in bindings and fields are replaced with `"[REDACTED]"` when their key
(case-insensitive) **contains** any of:

`password` · `token` · `secret` · `authorization` · `cookie`

So `accessToken`, `clientSecret`, `Set-Cookie` etc. are caught. Redaction
recurses through plain objects and arrays (class instances like `Error` or
`Date` are passed through untouched); circular references are replaced with
`"[Circular]"`.

## Per-request logger (server hook)

`requestLogger(base, req?)` returns a child bound with `requestId` — taken
from the request's `x-request-id` header, or a generated UUID. Recipe for an
app's tRPC server (T3.1):

```ts
const base = createLogger().child({ app: 'hub' })
const makeContext = createContext({ store, blobs, logger: base })

const createContextForRequest = (req: Request) => ({
  ...makeContext(req),
  logger: requestLogger(base, req),
})
```

Every handler log line for that request then carries the same `requestId`.

## Testing

`createLogger({ write })` accepts a sink `(line: string) => void`, so tests
capture lines in an array and `JSON.parse` them — no stdout patching. See
`src/logger.test.ts`.
