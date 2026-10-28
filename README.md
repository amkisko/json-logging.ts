# @amkisko/json-logging

Structured JSON logging for Bun, Node, Deno, Next.js, and Remix. The portable API follows the Ruby `activesupport-json_logging` gem style: create a logger, call severity methods, use `tagged` and `withContext`, and emit one JSON object per line.

Zero runtime dependencies. Ambient `withContext` / block `tagged` use AsyncLocalStorage when the runtime exposes it through `process.getBuiltinModule("async_hooks")` (Node, Bun, Deno with Node builtins, Cloudflare Workers with `nodejs_compat`). The package never statically imports `node:async_hooks`, so browsers and Workers without Node builtins can still import and emit basic JSON lines; ambient context is a no-op there. On Workers that import `AsyncLocalStorage` from `node:async_hooks` themselves, call `configureContextStorage(new AsyncLocalStorage())` once at boot. Call `isAsyncLocalStorageAvailable()` to detect ALS. Helpers under `@amkisko/json-logging/next` and `@amkisko/json-logging/remix` use Web APIs and do not add framework packages as runtime dependencies.

## Runtime compatibility

| Runtime | Support | Notes |
| --- | --- | --- |
| Node.js | Compatible | Primary target; ALS context works. |
| Bun | Compatible | Tested in CI; `@amkisko/json-logging/bun` for `Bun.serve`. |
| Deno | Compatible | ALS via Deno Node builtins (`getBuiltinModule`). |
| Cloudflare Workers | Compatible | Full ALS with `nodejs_compat` (soft-load or `configureContextStorage`). Without it: import and basic logging still work; `withContext` does not retain fields unless you inject ALS. |
| Browsers | Compatible | Basic logging and sinks work. Ambient context requires a host that provides ALS (unusual in browsers). |

On the JSR package settings page, mark Node.js, Bun, Deno, Cloudflare Workers, and Browsers as compatible. Keep the package description aligned with `package.json` (`JSR_TOKEN=... ./usr/bin/sync-jsr-settings`, or set it in the Settings tab).

## Install

From npm:

```bash
bun add @amkisko/json-logging
npm install @amkisko/json-logging
```

From JSR:

```bash
deno add jsr:@amkisko/json-logging
npx jsr add @amkisko/json-logging
```

## Five-minute usage

```ts
import { JsonLogging, createLogger, withContext } from "@amkisko/json-logging";

const logger = JsonLogging.new();
// same as createLogger()

logger.info("server started");
logger.info({ event: "signup", userId: 42 });
logger.error(new Error("payment failed"));

logger.tagged("billing", () => {
  logger.info("invoice created");
});

const billing = logger.tagged("billing");
billing.info("sticky tags on child logger");

await withContext({ requestId: "abc" }, async () => {
  logger.info("handled request");
});
```

Each line looks like:

```json
{"message":"server started","severity":"INFO","timestamp":"2026-10-26T05:30:00.000000Z"}
```

Object fields merge at the root. Tags appear as `tags`. Request fields appear under `context`. System keys (`tags`, `severity`, `timestamp`, `message`, `context`) are reserved.

Optional hot-path helpers (RFC-0002, RFC-0005):

```ts
const logger = createLogger({
  level: "info",
  redact: {
    paths: ["user.password", "headers.authorization"],
    keys: ["ssn", "apiKey"],
    caseInsensitive: true,
    censor: "hash", // or "filtered" | "remove" | (value) => unknown
  },
  serializers: {
    err: (value) => value, // root-field transform
  },
});

if (logger.isLevelEnabled("debug")) {
  logger.debug({ detail: "expensive" });
}
```

Path-only form `redact: ["user.password"]` still applies `[FILTERED]`.

## Sinks

Console is the default. Pass a custom sink or a `WritableStream`:

```ts
import { createLogger, consoleSink, streamSink } from "@amkisko/json-logging";

createLogger({ sink: consoleSink() });
createLogger({ sink: streamSink(myWritableStream) });
createLogger({
  sink: {
    write(line, record) {
      // forward somewhere else
    },
  },
});
```

## Capture console and app logs (opt-in)

`JsonLogging.new()` alone does not rewrite `console` or framework logs. For app code plus `console.*`, use the opt-in bridge:

```ts
import { installStructuredLogging } from "@amkisko/json-logging/console";

const { logger, uninstall } = installStructuredLogging({
  base: { service: "api" },
});

logger.info("structured");
console.log("also structured"); // routed through the same logger
```

Or attach a bridge to an existing logger:

```ts
import { createLogger } from "@amkisko/json-logging";
import { installConsoleBridge } from "@amkisko/json-logging/console";

const logger = createLogger({ base: { service: "api" } });
const uninstall = installConsoleBridge(logger);
```

Runnable patterns live under `examples/`:

- `examples/bun-entry.ts`
- `examples/next-instrumentation.ts`
- `examples/remix-handle-request.ts`

### What becomes structured

- Calls on the package logger (`info`, `tagged`, `withContext`, ...)
- `console.log` / `info` / `warn` / `error` / `debug` after `installConsoleBridge` or `installStructuredLogging`
- Code that already logs through those console methods

### What does not

- Next.js / Remix / Vite / Bun CLI and framework internals
- Browser DevTools console
- Libraries that write straight to `process.stdout` / `stderr` or their own transports (Pino destinations, Winston file transports, etc.) without going through `console`
- Middleware ALS context continuing into a later Node App Router handler (forward `x-request-id` and call `withContext` again)

## HTTP adapters

Shared helpers live under `@amkisko/json-logging/http`. Framework subpaths are duck-typed and add no runtime dependencies (RFC-0003):

- `@amkisko/json-logging/next`
- `@amkisko/json-logging/remix`
- `@amkisko/json-logging/hono`
- `@amkisko/json-logging/express`
- `@amkisko/json-logging/fastify` (route handler wrap)
- `@amkisko/json-logging/koa`
- `@amkisko/json-logging/bun`

CI runs end-to-end adapter checks under `tests/e2e/` against real packages as development dependencies: Hono (`app.request`), Express and Koa (listen + `fetch`), Fastify (`inject`), `Bun.serve`, Next.js (`NextRequest` from `next/server` through `withRequestLogging`), Remix (`createRequestHandler` from `@remix-run/node` with a loader under `withRemixContext`), and NestJS composition (Express `app.use(withExpressLogging)` and Fastify `withHttpContext` interceptor). CI also runs a Node runtime smoke (`make node-smoke`) and an Edge import-graph check (`make edge-import`) so Edge-oriented entrypoints do not statically import forbidden Node builtins. CI does not boot a full Next, Remix, or Nest production app process; it uses the same request and handler APIs those apps call.

```ts
import { bindHttpLogger, httpLogger } from "@amkisko/json-logging/http";
import { withHonoLogging } from "@amkisko/json-logging/hono";

bindHttpLogger(httpLogger({ loggerOptions: { base: { service: "api" } } }));
app.use(withHonoLogging());
```

There is no dedicated `./nest` or `./sails` export. NestJS on the Express platform uses `app.use(withExpressLogging(...))`. NestJS on Fastify uses a request interceptor (or equivalent) that calls `withHttpContext` from `./http` around the handler. Sails.js sits on Express: mount `withExpressLogging` on the underlying Express app (for example via custom middleware / `sails.hooks.http.app`).

Ambient logger helpers live only on `./http` so framework entrypoints stay slim. Run microbenchmarks with `make bench` (ceilings in `usr/budgets/bench.json`).

## Next.js

Boot once (for example from `instrumentation.ts`), then wrap middleware:

```ts
import { installStructuredLogging } from "@amkisko/json-logging/console";
import { bindHttpLogger, httpLogger } from "@amkisko/json-logging/http";
import { withRequestLogging } from "@amkisko/json-logging/next";

const { logger } = installStructuredLogging({ base: { service: "next-app" } });
bindHttpLogger(logger);

export default withRequestLogging(async (req) => {
  httpLogger().info({ event: "middleware", path: req.nextUrl?.pathname });
  // return NextResponse.next()
});
```

See `examples/next-instrumentation.ts`.

## Remix

```ts
import { installStructuredLogging } from "@amkisko/json-logging/console";
import { bindHttpLogger, httpLogger } from "@amkisko/json-logging/http";
import { withRemixContext } from "@amkisko/json-logging/remix";

const { logger } = installStructuredLogging({ base: { service: "remix-app" } });
bindHttpLogger(logger);

return withRemixContext({ request, context }, () => {
  httpLogger().info("loading");
  return handle(request);
});
```

See `examples/remix-handle-request.ts`.

## Development

```bash
bun install
make check
```

`make check` runs Biome (`biome.json`), prose checks, typecheck, type-coverage (100% strict), tests with coverage thresholds at 100%, mutation checks, dependency audit, LOC gate, bundle size budget, example smoke, Edge import-graph check, and Node runtime smoke. `make ci` also builds `dist/` and runs `make bench` (ceilings in `usr/budgets/bench.json`).

Release:

```bash
make release
make release DRY_RUN=1
make release VERSION=0.1.0
```

`make release` reads the first `## X.Y.Z` heading in `CHANGELOG.md`, runs quality gates, publishes to npmjs, pushes a version tag, and leaves JSR publishing to GitHub Actions (OIDC provenance). Optional `VERSION=` overrides the changelog heading. Keep `package.json` and `jsr.json` version fields in sync before release. Create the `@amkisko` scope and `json-logging` package on [jsr.io](https://jsr.io/new), then link this GitHub repository in the JSR package settings so tag publishes can authenticate.

Quality scripts live under `usr/bin/` (same layout as other amkisko libraries). Bundle ceilings are in `usr/budgets/bundle.json`. Product-facing notes live in `CHANGELOG.md`; engineering drafts under `docs/changelogs/`.

## License

MIT (see `LICENSE.md`)
