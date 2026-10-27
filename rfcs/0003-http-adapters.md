# RFC 0003: Shared HTTP request context and framework subpath adapters

- Type: Standards Track
- Status: Experimental
- Created: 2026-10-26
- Author: maintainers
- Relates: RFC-0002
- Requires: RFC-0002

## Summary

Factor shared request-id and path extraction into a Web-API helper module. Expose thin subpath adapters for common HTTP frameworks and runtimes. Adapters MUST NOT add runtime dependencies; they duck-type request shapes and wrap `withContext`.

## Motivation

`./next` and `./remix` duplicate request-id allocation and path parsing. Apps on Hono, Express, Fastify, Koa, and Bun.serve need the same ALS context pattern without pulling framework packages into this library.

## Guide-level explanation

```ts
import { withHttpContext, allocateRequestId } from "@amkisko/json-logging/http";
import { withHonoLogging } from "@amkisko/json-logging/hono";

app.use(withHonoLogging());

// Express-style
import { withExpressLogging } from "@amkisko/json-logging/express";
app.use(withExpressLogging());
```

Each adapter binds an optional ambient logger and runs the handler inside `withContext` with `requestId`, `method`, and `path` when available.

## Reference-level explanation

### Shared module `@amkisko/json-logging/http`

Exports:

- `allocateRequestId(existing, randomId?)`
- `defaultRandomId` / `fallbackRequestId`
- `requestPathFromUrl(url: string): string | undefined`
- `httpFieldsFrom(input): Record<string, unknown>` building `requestId`, `method`, `path`
- `withHttpContext(input, fn, options?)` calling `withContext`

Duck types use Web `Headers` or a `headers.get` / Node-like `headers` record. No `node:http` import in the shared module.

Inbound `requestId` values MUST match `/^[\w.\-:]{1,128}$/` or a new id is allocated. `requestPathFromUrl` MUST return pathname only (no query or hash). Remix load context fields enter log context only via explicit `contextKeys`. Adapter `logger` options bind ambient logger once at factory creation.

### Subpath adapters

Each subpath is a published export. Core `"."` MUST NOT import adapters.

| Export | Role |
| --- | --- |
| `./http` | Shared helpers |
| `./next` | Existing Next middleware/route wrap; reuses `./http` |
| `./remix` | Existing Remix wrap; reuses `./http` |
| `./hono` | Middleware `(c, next) => ...` |
| `./express` | `(req, res, next) => ...` |
| `./fastify` | Route handler wrap (`withFastifyLogging(handler)`) |
| `./koa` | `(ctx, next) => ...` |
| `./bun` | Fetch handler wrap for `Bun.serve` |

Adapters MAY declare TypeScript-only ambient types locally. They MUST NOT list framework packages in `dependencies` or `peerDependencies` unless a later RFC proves a typed peer is required.

Adapter modules MUST import request helpers from a context module that does not import `createLogger`. Ambient `bindHttpLogger` / `httpLogger` / `resetHttpLoggerForTests` live on `./http` only. The opt-in console bridge lives on `./console`, not on `.`.

### Bundle and LOC

Each adapter file stays at or under 150 LOC target (300 hard gate). Bundle budget lists `dist` totals and MAY add per-entry ceilings when growth exceeds the shared growth allowance. Raising the published byte ceiling needs an updated baseline in the same change.

### Ambient logger pattern

Keep `bind*Logger` / `*Logger()` / `reset*LoggerForTests()` per adapter family, or share one ambient binder on `./http` if duplication exceeds two copies. Prefer one shared ambient binder when a third adapter lands.

## Security considerations

Request headers are untrusted. Only copy allowlisted fields (`requestId`, `method`, `path`) into context by default. Do not log raw Authorization headers.

## Registrar

- Package exports: `./http`, `./hono`, `./express`, `./fastify`, `./koa`, `./bun`
- `withHttpContext`, `httpFieldsFrom`
- `withHonoLogging`, `withExpressLogging`, `withFastifyLogging`, `withKoaLogging`, `withBunLogging`

## Drawbacks

More export surface to document and test. Duck types can drift from framework upgrades. Ambient loggers remain process-global and need test resets.

## Rationale and alternatives

Shared `./http` avoids copy-paste across adapters. Separate subpaths keep Edge and Node importers from pulling unused code. Reject a single mega-adapter package: tree-shaking and Edge graphs suffer. Reject runtime framework dependencies: contradicts zero-dep core.

## Prior art

Request-scoped context via AsyncLocalStorage. Middleware wrappers that inject correlation ids. Thin SDK subpath exports per framework.

## Unresolved questions

- NestJS: decorator-only adapter in a later RFC, or document composition with Express/Fastify adapters.
- Whether `./http` should accept Node `IncomingMessage` without importing `node:http` (header record duck type only).
- Smoke examples: one file per adapter vs one matrix script.

## Future possibilities

React Router middleware helper. Cloudflare Workers fetch wrap. OpenTelemetry baggage bridge via `contextProvider` (RFC-0004). Request completion lines and header allowlists (RFC-0004).
