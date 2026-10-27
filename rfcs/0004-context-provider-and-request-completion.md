# RFC 0004: Context provider, request completion line, header allowlist

- Type: Standards Track
- Status: Experimental
- Created: 2026-10-26
- Author: maintainers
- Relates: RFC-0002, RFC-0003
- Requires: RFC-0002, RFC-0003

## Summary

Add an optional log-time `contextProvider` for baggage and trace fields without core OpenTelemetry deps. Add a shared request-completion log helper and opt-in adapter completion lines. Allow copying named request headers into ALS context via an explicit allowlist.

## Motivation

Cross-language survey patterns (Swift MetadataProvider, Serilog request logging, ASP.NET header allowlists) show apps need (1) a zero-dep hook for ambient enrichment, (2) one canonical completion line per request, and (3) safer header capture than denylist-only. Construction-time sanitize of sticky `base` and `tags` (RFC-0002 amend) cuts hot-path work when those values are stable.

## Guide-level explanation

```ts
import { createLogger } from "@amkisko/json-logging";
import {
  httpLogger,
  logRequestCompletion,
  withHttpContext,
} from "@amkisko/json-logging/http";
import { withExpressLogging } from "@amkisko/json-logging/express";

const logger = createLogger({
  contextProvider: () => ({
    trace_id: readTraceIdFromSomewhere(),
  }),
});

app.use(
  withExpressLogging({
    logger,
    logCompletion: true,
    headersAllowlist: ["x-correlation-id"],
  }),
);

// Or manually:
await withHttpContext(req, async () => {
  const started = performance.now();
  // ...
  logRequestCompletion(httpLogger(), {
    method: "GET",
    path: "/health",
    status: 200,
    elapsedMs: performance.now() - started,
  });
});
```

## Reference-level explanation

### Construction-time sanitize (RFC-0002 amend)

`Logger` construction MUST sanitize `base` with `sanitizeHash` and prepare sticky `tags` with `prepareTags` once. `child` and sticky `tagged` MUST reuse already-sanitized copies without re-sanitizing unchanged sticky values on every log call. Mutating the object passed as `options.base` after construction MUST NOT change later log lines.

### contextProvider

`LoggerOptions.contextProvider` is optional `() => Record<string, unknown> | undefined`.

- Called inside `buildRecord` after ALS ambient context is merged into `context`.
- Return value is sanitized; keys in `SYSTEM_KEYS` are dropped; remaining keys merge under `context`.
- Call-site message fields and message `context` MUST win over provider keys on collision.
- If the provider throws, the log path MUST take the never-raise fallback (same as a throwing serializer).
- Core MUST NOT import OpenTelemetry packages; apps supply the callback.

### logRequestCompletion

`./http` exports:

```ts
logRequestCompletion(
  logger: Logger,
  fields: {
    method?: string;
    path?: string;
    status: number;
    elapsedMs: number;
    error?: unknown;
  },
): void
```

- Emits one structured line with `event: "http_request"`, `status`, `elapsedMs`, and optional `method` / `path` (pathname only; no query).
- Level is `error` when `status >= 500` or `error` is set; otherwise `info`.
- When `error` is set, include a sanitized `error` field via existing error shaping.

### Adapter option logCompletion

`logCompletion?: boolean` defaults to `false` on Express, Hono, Koa, Fastify, and Bun adapters.

- When true, adapters MUST call `logRequestCompletion` once per request after the handler finishes (or on Express `res` finish).
- Status comes from the framework response when available; otherwise omit and use `error` presence for level when applicable.
- Elapsed time is wall milliseconds from enter to completion.

### headersAllowlist

`WithHttpContextOptions.headersAllowlist?: readonly string[]` copies those header names into ALS context (string values through existing sanitize). HTTP fields (`requestId`, `method`, `path`) still win over allowlisted keys of the same name. Listing `Authorization` or cookie headers is an explicit operator risk and MUST be documented; defaults remain empty (no extra headers).

## Security considerations

Request headers are untrusted. Do not enable broad allowlists. Prefer correlation ids over secrets. `contextProvider` MUST NOT throw secrets into logs without app-level redaction.

## Registrar

- `LoggerOptions.contextProvider`
- `logRequestCompletion`
- Adapter `logCompletion`
- `WithHttpContextOptions.headersAllowlist`

## Drawbacks

More options on adapters and logger construction. Completion lines can double volume when apps already log access elsewhere (opt-in mitigates).

## Rationale and alternatives

Provider callback keeps OTel out of the core graph. Shared completion helper avoids per-adapter schema drift. Reject auto-completion by default: breaks existing quiet middleware. Reject string-only MDC-style maps as the only enrichment path: preserve JSON value types from the provider return.

## Prior art

Swift MetadataProvider; Serilog `UseSerilogRequestLogging`; ASP.NET HttpLogging header allowlist; Elixir LoggerJSON precompile; survey docs/plans/20261026115000_cross-language-json-logging-survey.md.

## Unresolved questions

- Whether Next/Remix helpers grow `logCompletion` in this RFC or a follow-up.
- Whether `elapsedMs` should be integer-rounded for stable fixtures (this RFC: number as measured; tests may round).

## Future possibilities

Cloud Run severity alias adapter. Document dehydrate/hydrate of `getContext` across isolate hops. Dev pretty sink (separate RFC).
