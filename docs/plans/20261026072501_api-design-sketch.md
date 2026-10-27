# API design sketch: @amkisko/json-logging

Companion to docs/plans/20261026072500_ecosystem-research.md. Design only; no library implementation in this note. Target: mirror Ruby activesupport-json_logging (JsonLogging.new, tagged, with_context) on TypeScript for Next.js, Remix, Bun, and Node with zero runtime dependencies. Labels: Fact for upstream API facts; Inference for proposed TypeScript shape.

## Decisions

- Package name `@amkisko/json-logging` with subpath exports `./next` and `./remix`.
- Zero runtime dependencies. Dev/test tools only. Optional peer types for Next/Remix stay peerOptional if declared at all.
- Default sink writes one JSON object per line via console methods mapped by level (error/warn/info/debug). Alternate sink accepts a Web WritableStream of Uint8Array or string chunks.
- Request and block context use AsyncLocalStorage.run only (portable subset). Fact: Workers omit enterWith/disable; Next Edge polyfills ALS; Bun and Node implement ALS.
- Payload shape mirrors the Ruby gem after 1.1.0: root keys timestamp, severity (or level), message, tags, context; user fields must not overwrite system keys.
- Logging never throws to the caller. Fact: Ruby formatter writes a fallback entry on encode failure. Inference: TypeScript does the same.

## Effects

### Core factory (JsonLogging.new mirror)

Inference: expose both a namespaced helper and a create function for ESM idioms.

```ts
import { JsonLogging, createLogger } from "@amkisko/json-logging";

const logger = JsonLogging.new(); // console JSON sink, level info
const logger2 = createLogger({
  level: "debug",
  sink: consoleSink(),
  base: { service: "api" },
});
```

Proposed options (Inference):

- level: "debug" | "info" | "warn" | "error" | "fatal"
- sink: Sink (default console)
- base: Record of fields merged into every line (service name, env)
- clock: () => Date for tests
- serializeError: custom Error mapper

Method surface (Inference, aligned with Ruby):

- logger.debug|info|warn|error|fatal(message)
- message may be string, plain object (merged into payload), or Error (serialized)
- logger.child(bindings) optional alias for permanent field merge; tagged remains the Rails-shaped API

### tagged

Fact (Ruby): tagged(*tags) with block scopes tags for the block; without block returns a new logger carrying permanent tags; nested tagged stacks tags.

Inference (TypeScript):

```ts
await logger.tagged("REQUEST", requestId, async () => {
  logger.info("processing");
});

const serviceLog = logger.tagged("billing");
serviceLog.info("invoice created"); // tags: ["billing"]

logger.tagged("a").tagged("b").info("x"); // tags: ["a","b"]
```

Sync and async callbacks both supported. Without callback, return a new Logger instance sharing sink and level, with tags concatenated.

### withContext

Fact (Ruby): JsonLogging.with_context(**fields) { ... } adds thread-local context to all entries in the block.

Inference (TypeScript): module-level helper using one package ALS store:

```ts
import { withContext, getContext } from "@amkisko/json-logging";

await withContext({ requestId, userId }, async () => {
  logger.info("ok"); // context includes requestId, userId
});

getContext(); // current store or undefined
```

Nested withContext shallow-merges. Tags and context are distinct: tags are an array at root; context is an object at root. System keys filtered from user context.

### Sinks

Inference:

```ts
type Sink = {
  write(line: string, record: LogRecord): void | Promise<void>;
};

function consoleSink(): Sink;
function streamSink(stream: WritableStream<Uint8Array>, opts?: { encoding?: "utf-8" }): Sink;
```

consoleSink maps severity to console.error / console.warn / console.info / console.debug and prints the JSON string (or a single object argument if a future pretty mode is added; default is JSON string for aggregators).

streamSink encodes UTF-8 with trailing newline. Callers own stream lifecycle (especially Workers: dispose via waitUntil). Fact: LogTape documents WritableStream sinks and Workers dispose timing; this package should document the same constraint without depending on LogTape.

### AsyncLocalStorage rules

- One ALS instance exported from the package (or held privately and shared via withContext/getContext) so bundlers do not duplicate stores. Inference: guard with globalThis symbol key if dual package hazard appears (Remix community lesson).
- Public API: withContext / getContext only; do not expose enterWith.
- If ALS is missing at runtime, withContext runs the callback without storage and getContext returns undefined (Inference: fail soft for exotic targets).

### Next.js helpers (`@amkisko/json-logging/next`)

Inference:

```ts
import { withRequestLogging, requestLogger } from "@amkisko/json-logging/next";

// Middleware or route wrapper
export default withRequestLogging(async (req, event) => {
  const log = requestLogger();
  log.info({ event: "middleware", path: req.nextUrl.pathname });
  return NextResponse.next();
});
```

Behavior sketch:

- Allocate or read x-request-id (configurable header name).
- withContext({ requestId, path, method }, ...).
- Edge-safe: only Web APIs and package core; no node:fs, no worker transports.
- Document that Middleware context does not automatically continue into Node App Router handlers; apps that need continuity should forward requestId via headers and call withContext again in the Node handler or instrumentation path.
- Optional Node Middleware (Next 15.5+ runtime: 'nodejs') uses the same helper; no separate API.

### Remix helpers (`@amkisko/json-logging/remix`)

Inference:

```ts
import { withRemixContext, remixLogger } from "@amkisko/json-logging/remix";

// In middleware or handleRequest
return withRemixContext({ request, context }, () => handle(request));

// In loaders
remixLogger().info("loading");
```

Also accept an explicit context bag from getLoadContext / RouterContextProvider so ALS-optional deployments can pass requestId without ALS. Prefer ALS when available for deep call stacks (RSC / nested loaders).

### Edge constraints (package rules)

- Core and ./next must tree-shake to code that runs under Next Edge and Cloudflare Workers constraints: no eval, no native addons, no filesystem, no thread-stream.
- Prefer `import type` for Next/Remix types so runtime stays dep-free.
- Document Workers need for node:async_hooks ALS (compat flag or compatibility date). Fact: Cloudflare docs.
- Bundle size goal Inference: keep min+gzip competitive with small console JSON helpers; do not chase Pino Node throughput features.

### Serialization contract

Inference defaults for experiments (see research note section 8):

- Circular objects -> "[Circular]"
- BigInt -> string decimal
- undefined omitted; symbol keys omitted
- Error -> { name, message, stack?, cause? } under message or error key (pick one in implementation RFC; Ruby nests exception fields in message parsing -- prefer a dedicated `error` object for clarity in TS)
- Depth or key count caps to bound CPU on hostile objects
- Never throw from serialize or write; on failure emit a minimal fallback line with logger_error

### package.json exports sketch

Inference:

```json
{
  "name": "@amkisko/json-logging",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./next": {
      "types": "./dist/next.d.ts",
      "import": "./dist/next.js"
    },
    "./remix": {
      "types": "./dist/remix.d.ts",
      "import": "./dist/remix.js"
    }
  },
  "files": ["dist"],
  "sideEffects": false
}
```

Layout: `src/`, `tests/`, `dist/` build output. No runtime dependency entries.

### Minimum configuration story

Inference: zero-config path is createLogger() or JsonLogging.new() with console JSON. Apps that need streams pass streamSink. Framework apps import one helper and wrap the request boundary. No global configure() required for libraries that only call logger methods when a logger is injected; for ambient withContext, document that the app owns the boundary wrapper.

## Next

- Run isolated experiments: safe stringify, circular refs, Error + cause, tagged child identity, ALS nesting under Bun and Node.
- Spike Next Edge middleware import graph (fail if Node-only modules resolve).
- Spike Workers fixture with ALS run/getStore.
- Choose test runner and wire c8 or bun test --coverage plus type-coverage --at-least 100.
- Draft public TypeScript types in an RFC issue before coding src/.
- Do not implement the publishable package in the same change set as these plans unless a later issue accepts this sketch.

## Source

- docs/plans/20261026072500_ecosystem-research.md
- https://github.com/amkisko/activesupport-json_logging.rb/blob/main/README.md
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/
- https://nextjs.org/docs/app/api-reference/edge
- https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware
- https://github.com/remix-run/react-router/blob/main/docs/how-to/middleware.md
