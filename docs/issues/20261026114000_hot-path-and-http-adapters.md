# Hot-path performance and HTTP adapters

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Ship RFC-0001 process, RFC-0002 hot-path (isLevelEnabled, redact paths, serializers, bench gate), RFC-0003 HTTP adapters on branch `feature/hot-path-and-adapters`.
- Remix without an inbound id now allocates a request id (same as Next helpers) via shared `./http`.
- Fastify adapter wraps route handlers; onRequest-only hooks cannot keep ALS across the request with `run()` alone.
- Bundle baseline raised to measured dist size after adapter exports; timing ceilings stay in `usr/budgets/bench.json`.

## Effects

- Core: `Logger.isLevelEnabled`, `LoggerOptions.redact`, `LoggerOptions.serializers`, `applyRedactPaths`.
- Exports: `./http`, `./hono`, `./express`, `./fastify`, `./koa`, `./bun`; Next/Remix reuse `./http`.
- `make bench` and `make ci` include the bench gate.

## Effects (framework e2e)

- CI e2e under `tests/e2e/` hits real Hono, Express, Fastify, Koa, Bun.serve, Next `NextRequest`, Remix `createRequestHandler`, and Nest Express/Fastify composition. See `docs/changelogs/20261027152700_framework-adapter-e2e.md`, `docs/changelogs/20261027161000_next-remix-framework-e2e.md`, and `docs/changelogs/20261027163000_nest-node-edge-smokes.md`.
- Nest/Sails: composition docs only (no new export). Node smoke + Edge import-graph gates in `make check`.

## Next

- Calibrate bench ceilings on CI runner class; mark RFCs Proposed when green.
- Optional pack-size gate that inspects `npm pack` tarball maps (local dist may still emit maps).
- Survey follow-ups still open: Cloud Run severity alias, dehydrate/hydrate docs, Lambda/Workers smoke claims.

## Source

- `rfcs/0002-hot-path-performance.md`
- `rfcs/0003-http-adapters.md`
- `rfcs/0004-context-provider-and-request-completion.md`
- `docs/plans/20261026115000_cross-language-json-logging-survey.md`
- `usr/budgets/bench.json`
- `usr/budgets/bundle.json`
## Effects (audit follow-up)

- Remix no longer spreads full load context; use `contextKeys`.
- Paths drop query/hash; request ids validated; fallback ids include a counter.
- Adapter `logger` binds at factory time; Bun forwards rest args; Fastify keeps `this`.
- Redact paths compile once per logger; bench ceilings tightened; with-context measured inside one ALS run.

## Effects (slimness audit follow-up)

- Split `http-context` / `http-ambient` so framework entries do not load `createLogger` until `./http` is used.
- Ambient bind/get/reset live only on `./http`; adapters export `with*` only.
- Console bridge moved to `./console`; root `.` no longer pulls the bridge module.
- Publish tree omits `*.map` via `files` + `.npmignore`.

## Effects (survey phase 1 / RFC-0004)

- Logger construction sanitizes `base` and prepares sticky `tags` once; hot path skips re-sanitize.
- `LoggerOptions.contextProvider` merges under `context` after ALS; call-site wins; throw uses never-raise fallback.
- `logRequestCompletion` on `./http`; adapter `logCompletion` opt-in; `headersAllowlist` for named headers.
- Bench scenarios `sticky-base-info` and `context-provider` added to `usr/budgets/bench.json`.

