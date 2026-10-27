# Hot-path performance and HTTP adapters

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Adopt RFC-0001 process tree and ship Experimental RFC-0002 and RFC-0003.
- Add `isLevelEnabled`, path `redact`, root `serializers`, and `make bench` ceilings.
- Factor `./http` and thin duck-typed adapters: hono, express, fastify (route wrap), koa, bun; Next/Remix reuse shared helpers.

## Effects

- Public options: `LoggerOptions.redact`, `LoggerOptions.serializers`, `Logger.isLevelEnabled`.
- Package exports: `./http`, `./hono`, `./express`, `./fastify`, `./koa`, `./bun`.
- Remix without inbound id allocates a request id (aligned with Next helpers).
- Bundle baseline updated for adapter surface; timing gate in `usr/budgets/bench.json`.

## Next

- Apply multi-model audit fixes; mark RFCs Proposed/Stable when ceilings hold on CI runners.
- Optional Nest composition docs without a new export.

## Source

- `rfcs/0002-hot-path-performance.md`
- `rfcs/0003-http-adapters.md`
