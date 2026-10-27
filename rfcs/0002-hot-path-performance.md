# RFC 0002: Hot-path performance, redact paths, serializers, benchmarks

- Type: Standards Track
- Status: Experimental
- Created: 2026-10-26
- Author: maintainers
- Relates: RFC-0003

## Summary

Extend the core logger with hot-path guards, optional path-based redaction, optional field serializers, and a maintained benchmark harness with absolute ceilings. Keep zero runtime dependencies and per-file LOC gates.

## Motivation

Disabled levels still pay for argument work when callers build objects before the log call. Sensitive nested fields need path targeting beyond key-name filters. Apps need typed hooks for Error and request-shaped values. Without a local bench gate, size and latency grow unnoticed.

## Guide-level explanation

```ts
const logger = createLogger({
  level: "info",
  redact: ["user.password", "headers.authorization"],
  serializers: {
    err: (value) => sanitizeError(value as Error),
  },
});

if (logger.isLevelEnabled("debug")) {
  logger.debug({ detail: expensive() });
}

logger.info({ err: new Error("fail"), user: { password: "x" } });
```

Run benches:

```bash
make bench
```

CI fails when a named scenario exceeds its ceiling in `usr/budgets/bench.json`.

## Reference-level explanation

### isLevelEnabled

`logger.isLevelEnabled(level)` returns true when `level` is at or above the configured level. `log` MUST return before `buildRecord` when disabled.

### redact

`LoggerOptions.redact` is an optional list of dot paths. Wildcards MAY use `*` for one segment. Matching leaf values become `"[FILTERED]"` after key-name filtering. Paths are compile-time config, not user input. Invalid path strings are ignored.

### serializers

`LoggerOptions.serializers` maps root field names to `(value: unknown) => unknown`. Applied after message parse and before redact. A serializer that throws is treated as encode failure and takes the never-raise fallback path.

### Construction-time sanitize

`Logger` construction MUST sanitize `base` once and prepare sticky `tags` once. `child` and sticky `tagged` reuse those prepared values. Per-call `buildRecord` MUST NOT re-sanitize unchanged sticky base/tags. See also RFC-0004 for `contextProvider`.

### Benchmarks

Scenarios (minimum):

1. `disabled-debug`: level info, `debug("x")` no-op
2. `string-info`: `info("hello")`
3. `object-info`: `info({ event: "a", n: 1 })`
4. `error-info`: `info(new Error("e"))`
5. `with-context`: ALS context set, then `info("x")`
6. `redact-path`: redact one nested path, then `info(object)`
7. `sticky-base-info`: logger with a large sanitized `base`, then `info("x")` (RFC-0004)
8. `context-provider`: logger with an empty `contextProvider`, then `info("x")` (RFC-0004)

Metric: median nanoseconds per call over a fixed iteration count on Bun. Each scenario has `ceiling_ns` in `usr/budgets/bench.json`. Sample records start/finish timestamps and runner class. Size budgets stay in `usr/budgets/bundle.json` and MUST NOT mix with timing.

### Non-goals

Worker transports, file destinations, custom level registries, and pretty printers stay out of this RFC.

## Security considerations

Redact paths MUST NOT come from request input. Path compilation MUST NOT evaluate code.

## Registrar

- `Logger.isLevelEnabled`
- `LoggerOptions.redact`
- `LoggerOptions.serializers`
- `make bench`
- `usr/budgets/bench.json`

## Drawbacks

More options on the core logger. Path redact adds work on every object log when configured. Bench ceilings can flake on busy hosts; use medians and generous absolute ceilings.

## Rationale and alternatives

Put redact and serializers on the logger, not a separate pipeline package, so Edge importers stay one graph. Reject wrapping a third-party logger: dependency and Edge I/O cost. Reject only documenting performance without a gate: ceilings drift.

## Prior art

ActiveSupport-style tagged loggers with never-raise formatters. JSON lines to stdout for container log shipping. Optional field transforms at log time.

## Unresolved questions

- Exact iteration count and warm-up for CI stability on GitHub runners.
- Whether `redact` accepts `{ paths, censor }` in this RFC or a follow-up.
- Whether serializers run on nested paths or only root keys (this RFC: root keys only).

## Future possibilities

Async sink batching. Development pretty sink. Adapter-specific serializers (RFC-0003).
