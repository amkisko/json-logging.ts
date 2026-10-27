# Framework adapter end-to-end tests

## Decisions

- Prove HTTP adapters against real framework packages in CI as development dependencies only; keep published runtime dependencies empty.
- Cover Hono, Express, Fastify, Koa, and Bun.serve with listen/request/inject paths that await inside the handler and assert ALS context plus optional completion lines.
- Cover Next and Remix helpers with Web Request / Headers (and Remix allowlisted context keys) without booting a full Next or Remix app.

## Effects

- Added `tests/e2e/*.e2e.test.ts` and shared helpers; `make check` includes them via `bun test`.
- DevDependencies: `hono`, `express`, `fastify`, `koa`, plus Express/Koa types.
- README HTTP adapters section states what CI proves and what it does not (no full Next/Remix app boot).

## Next

- Done in `docs/changelogs/20261027161000_next-remix-framework-e2e.md`: `NextRequest` and Remix `createRequestHandler` e2e.

## Source

- User request to e2e-test integrations for honest compatibility claims
- `rfcs/0003-http-adapters.md`
- `docs/issues/20261026114000_hot-path-and-http-adapters.md`
