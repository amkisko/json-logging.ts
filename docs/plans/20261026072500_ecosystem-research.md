# Ecosystem research: structured JSON logging for TypeScript

Design-only notes before implementing `@amkisko/json-logging`. Goal: a zero-dependency (or near-zero) package similar to Ruby `activesupport-json_logging`, with minimum configuration, for Next.js, Remix, Bun, and Node. Claims below are labeled Fact or Inference. Absolute local paths are omitted per docs conventions.

## Decisions

- Ship a thin first-party logger rather than wrapping Pino as a runtime dependency. Fact: project AGENTS dependency-policy says stop before adding a dependency unless stdlib, an existing transitive, or a proven need with tests covers it. Fact: Pino 10.x declares eleven runtime dependencies (including sonic-boom and thread-stream) on npm. Fact: Pino Node transports and destinations are not available in the browser build; Cloudflare maintainers and Pino authors state Node Pino transports do not fit Workers short-lived execution. Inference: wrapping Pino would pull Node-oriented I/O into Edge and Workers consumers or force dual code paths anyway.
- Treat LogTape as the closest existing zero-dep peer, not a package to wrap. Fact: LogTape markets zero dependencies, Node/Deno/Bun/browser/edge support, and WritableStream sinks. Inference: this package still earns a niche by mirroring JsonLogging.new / tagged / withContext semantics and thin Next/Remix helpers rather than LogTape categories and configure() surface.
- Prefer console and WritableStream sinks over worker transports. Fact: Edge and Workers favor console or short-lived writes; Pino authors say transports assume long-lived processes. Inference: JSON lines to stdout/stderr match container and platform log shipping.
- Use AsyncLocalStorage.run for request context; avoid enterWith in portable code. Fact: Cloudflare Workers documents ALS support with enterWith and disable omitted. Fact: Next.js Edge documents AsyncLocalStorage as a Next.js-specific polyfill. Fact: Bun implements AsyncLocalStorage and AsyncResource under node:async_hooks. Inference: run/getStore is the portable subset across Node, Bun, Next Edge, and Workers (with Workers nodejs_compat or default compat dates that enable Node compat).

## Effects

### 1. Comparable libraries (what they solve; Edge facts)

Pino. Fact: high-throughput JSON logger for Node; child loggers and serializers; Node-only destination, transport, and multistream. Fact: browser build logs via console methods and omits filesystem and worker-thread APIs. Fact: mcollina stated browser Pino should work on workerd; also stated Cloudflare Workers is not tested/supported for Pino. Fact: Next.js community reports pino.transport failing in Edge middleware. Inference: usable on Edge only as console-oriented browser mode, with feature gaps versus Node Pino.

Winston. Fact: flexible transports and formats; large dependency graph relative to Pino or LogTape marketing numbers. Fact: Next.js issues and discussions report Winston failing in middleware/Edge (process.nextTick and colors/argv assumptions). Inference: unsuitable as the Edge-shared core without a separate Edge stub.

Bunyan. Fact: classic Node JSON logger; primary tested target is Node.js; optional native deps (dtrace-provider, mv, moment) inflate install size unless --no-optional. Inference: not a good Edge-first foundation; maintenance cadence is slower than Pino.

LogTape. Fact: TypeScript-native, zero runtime dependencies, structured records, hierarchical categories, sinks including console and WritableStream; documents Edge and Cloudflare dispose patterns. Inference: strongest existing alternative for zero-dep universal logging; API philosophy differs from ActiveSupport-style tagged/withContext wrappers.

Roarr. Fact: JSON logger for Node and browser; three runtime deps (fast-printf, safe-stable-stringify, semver-compare); Node logs disabled unless ROARR_LOG=true; browser requires ROARR.write. Inference: closer to isomorphic JSON lines than Winston/Bunyan, but still not zero-dep and not ActiveSupport-shaped.

### 2. AsyncLocalStorage availability

Node. Fact: AsyncLocalStorage is stable in node:async_hooks (stable since Node 16.4).

Bun. Fact: Bun documents AsyncLocalStorage and AsyncResource as implemented; broader async_hooks lifecycle hooks are discouraged / incomplete (no V8 promise hooks).

Next.js Edge. Fact: Next.js Edge reference lists AsyncLocalStorage under Next.js-specific polyfills. Fact: historical Next.js PRs added ALS to the Edge sandbox as a global.

Cloudflare Workers. Fact: official docs implement a subset via `import { AsyncLocalStorage } from "node:async_hooks"` with nodejs_compat (or newer compatibility dates that enable Node compat by default). Fact: enterWith and disable are unsupported; thenables need snapshot/bind care.

Inference: a portable withContext should call als.run only, document Workers compat flags, and optionally detect missing ALS for graceful no-context fallback in exotic runtimes.

### 3. Next.js App Router and middleware constraints

Fact: Middleware historically defaults to Edge Runtime. Fact: Next.js 15 docs say Middleware defaults to Edge and as of v15.5 supports `export const config = { runtime: 'nodejs' }`. Fact: Edge Runtime forbids native Node APIs, filesystem, and CommonJS require; packages must be ESM without native Node APIs; eval and new Function are disabled. Fact: App Router route handlers and Server Components default to Node.js runtime unless `export const runtime = 'edge'`. Fact: instrumentation.js can branch on process.env.NEXT_RUNTIME for edge vs node. Fact: Middleware should not rely on shared mutable globals across the render process; pass correlation via headers, cookies, or URL when bridging Middleware to the app.

Inference: a Next helper must work when Middleware stays on Edge (console JSON sink, ALS polyfill) and when Node Middleware or Node route handlers use the same API. Do not assume Middleware ALS store is visible inside later Node request handling without an explicit bridge (for example request-id header).

### 4. Remix request context patterns

Fact: Classic Remix servers use getLoadContext to inject per-request values into loaders/actions. Fact: community patterns wrap request handling in AsyncLocalStorage.run and stash requestId; duplicate ALS module instances in Vite/dev builds broke getStore until a single globalThis singleton was used. Fact: React Router / Remix middleware docs prefer a first-class typed context API for runtime-agnostic middleware packages, and show ALS as optional for RSC-style same-stack access. Fact: remix/middleware/async-context documents getContext backed by ALS for Node-oriented routers; remix/middleware/logger documents request/response logging middleware.

Inference: `@amkisko/json-logging/remix` should offer (a) withContext around handleRequest / middleware next(), and (b) optional integration that reads Router context keys when ALS is unavailable. Prefer one ALS instance exported from the package root so app and server share the same store.

### 5. Why thin zero-dep is justified versus wrapping Pino

Fact: dependency-policy gate: stop before add unless stdlib/framework covers it, a transitive already covers it, or the feature needs a package and tests will prove behavior. Fact: ActiveSupport JsonLogging itself is a thin formatter around Logger with tagged and with_context, not a transport framework. Fact: Edge and Workers reject or degrade the parts of Pino that justify its dependency graph (sonic-boom destinations, thread-stream transports). Fact: LogTape already occupies universal zero-dep logging; the product gap is ActiveSupport API familiarity plus Next/Remix helpers with minimum configuration.

Inference: implementing safe stringify, Error serialization, tagged child loggers, and ALS context in a small first-party module passes the stop-before-add gate better than adding Pino. Optional later peerAdapter to forward into an existing Pino instance remains a non-runtime default.

### 6. Measurement tools for coverage goals

Runtime (aim 100% line/branch/function/statement as policy allows).

Fact: c8 uses V8 coverage and supports `c8 --100` thresholds compatible with Istanbul reporters. Fact: Bun test has built-in `--coverage`, bunfig.toml coverageThreshold, and lcov reporter. Fact: Vitest documents that V8 coverage does not work on Bun; Istanbul instrumentation works across runtimes.

Inference: primary CI should pick one runner. Prefer `bun test --coverage` with thresholds at 1.0 if Bun is the package test runtime; otherwise Node + c8 --100. Avoid claiming Istanbul and V8 numbers are interchangeable without a fixed runner.

Type (aim 100% type coverage).

Fact: type-coverage (plantain-00) measures identifiers not typed as any over all identifiers; supports --at-least 100 and --strict. Fact: `tsc --noEmit` proves the project typechecks but does not quantify any usage. Inference: gate CI on `tsc --noEmit` plus `type-coverage --at-least 100 --strict` (with documented ignores such as --ignore-catch only if needed). Custom scripts that walk the checker API are optional, not required for the first gate.

### 7. Proposed npm package layout

Inference (layout proposal; not implemented yet):

- package name `@amkisko/json-logging`
- `src/index.ts` core: createLogger / JsonLogging.new equivalent, tagged, withContext, levels, safe JSON line emit
- `src/context.ts` shared AsyncLocalStorage singleton
- `src/serialize.ts` safe stringify, circular refs, Error fields
- `src/sinks.ts` console sink and WritableStream sink
- `src/next.ts` Next middleware/request helpers (Edge-safe)
- `src/remix.ts` Remix/React Router withContext and optional middleware helper
- `tests/` mirrored unit tests; optional `tests/edge/` smoke with Edge constraints mocked
- `package.json` `"type": "module"`, exports map:
  - `"."` -> core
  - `"./next"` -> Next helpers
  - `"./remix"` -> Remix helpers
- runtime dependencies: none; peerDependencies optional and undeclared for next/remix types only if needed as peerOptional
- engines: Node versions that ship stable ALS; document Bun and Workers separately

### 8. Experiments worth trying before locking the API

Safe stringify. Fact: JSON.stringify throws on circular structures and BigInt. Inference: implement a visited-set replacer returning a stable marker (for example "[Circular]") and stringifying BigInt; never throw from the log path (mirror Ruby gem never-raise formatter).

Circular refs. Inference: property-path aware markers help debugging; keep payload size bounded.

Error serialization. Fact: Ruby JsonLogging formats Exception with class, message, and backtrace. Inference: serialize name, message, stack, and cause chain; avoid dumping non-enumerable junk by default.

Child tagged loggers. Fact: Ruby API supports tagged with block and tagged without block returning a new logger with permanent tags. Inference: TypeScript tagged(...tags) should match both shapes; tags array at JSON root key `tags`, context object under `context`, system keys filtered like the Ruby 1.1.0 change.

ALS nesting. Inference: withContext merges shallow context; nested runs should merge outer+inner and restore on exit.

Edge import graph. Inference: run a smoke build that forbids node:fs, worker_threads, and process.nextTick in the Edge entry; fail CI if core pulls them.

Winston/Pino interop. Inference: optional sink that accepts a write(line: string) function lets apps forward into existing loggers without depending on them.

## Next

- Lock API sketch in docs/plans/20261026072501_api-design-sketch.md (companion note).
- Prototype safe stringify and Error serialization as isolated experiments with recorded pass/fail before full package scaffolding.
- Confirm Next.js target matrix (Edge Middleware default vs Node Middleware 15.5+) in acceptance tests.
- Confirm Workers ALS behind documented compatibility date or nodejs_compat in a minimal worker fixture.
- Decide test runner (Bun vs Node+c8) before writing the first CI workflow.
- Do not publish or add runtime dependencies until experiments and API sketch are accepted.

## Source

- https://github.com/amkisko/activesupport-json_logging.rb
- https://www.npmjs.com/package/pino
- https://github.com/pinojs/pino/blob/main/docs/browser.md
- https://github.com/cloudflare/workerd/discussions/3423
- https://github.com/pinojs/pino/issues/2035
- https://github.com/vercel/next.js/discussions/67213
- https://nextjs.org/docs/app/api-reference/edge
- https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/
- https://blog.cloudflare.com/workers-node-js-asynclocalstorage/
- https://bun.com/reference/node/async_hooks
- https://bun.com/docs/test/coverage
- https://nodejs.org/api/async_context.html
- https://logtape.org/
- https://www.npmjs.com/package/roarr
- https://www.npmjs.com/package/bunyan
- https://github.com/winstonjs/winston/issues/2327
- https://github.com/remix-run/remix/discussions/4603
- https://github.com/remix-run/react-router/blob/main/docs/how-to/middleware.md
- https://api.remix.run/api/remix/middleware/async-context/overview/
- https://github.com/plantain-00/type-coverage
- https://www.npmjs.com/package/c8
- Project AGENTS.md dependency-policy and minimal-implementation sections
