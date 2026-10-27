# Initial implementation of @amkisko/json-logging

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Ship a zero-runtime-dependency TypeScript package with Bun as the package manager and test runner, and `tsc` emitting ESM to `dist/`.
- Mirror the Ruby gem experience: `JsonLogging.new` / `createLogger`, severity methods, `tagged` with or without callback, `withContext` / `getContext` via a `globalThis` AsyncLocalStorage singleton using `run` only.
- JSON lines use `timestamp`, `severity`, `message` or root object fields, optional `tags`, optional `context`. System keys are reserved; user conflicts move into `context`.
- Sanitizer bounds: circular markers, BigInt strings, depth 10, string length 10000, context key cap 50, Error under `error`, sensitive keys redacted to `[FILTERED]`.
- Log and serialize paths never throw; failures emit a fallback line with `logger_error`.
- Subpath exports: `.`, `./next`, `./remix` with `import type` only for framework shapes and no next/remix runtime dependencies.
- Quality gates: `bun test --coverage` thresholds at 100%, `type-coverage --at-least 100 --strict`, plus typecheck and build under `bun run check`.

## Effects

- Added `src/` modules for types, severity, context, objects, sanitize, serialize, sinks, logger, factory, and Next/Remix helpers.
- Added `tests/` covering logger API, tagged nesting, context nesting, sanitizer limits, sinks, fallbacks, and framework helpers with mocks.
- Added package manifests, `bunfig.toml` coverage thresholds at 1.0, `.gitignore`, MIT LICENSE, and README with install and five-minute usage.
- Observed gates: `bun test --coverage` at 100% lines and functions; `type-coverage --at-least 100 --strict` at 100.00%; `tsc` build to `dist/`.
- Documented plans already present under `docs/plans/` remain the design source for this changelog.

## Next

- Done in `docs/changelogs/20261027180000_release-0-1-0.md`: CHANGELOG frozen for 0.1.0; publish still waits on GitHub remote, npm/JSR package creation, and `make release`.
- Optional later: Workers fixture for ALS compatibility dates; optional peerAdapter sink for existing loggers.

## Source

- docs/plans/20261026072500_ecosystem-research.md
- docs/plans/20261026072501_api-design-sketch.md
- docs/plans/20261026072600_ruby-gem-parity-brief.md
- Sibling gem activesupport-json_logging (Ruby API and sanitizer limits)
