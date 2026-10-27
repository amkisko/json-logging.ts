# Nest composition, Node smoke, Edge import check

## Decisions

- No `./nest` or `./sails` export. Nest Express uses `withExpressLogging`; Nest Fastify uses a `withHttpContext` interceptor. Sails uses `./express` on the underlying Express app.
- Add NestJS packages only as development dependencies for e2e.
- Gate Edge claims with a static import-graph check on Web-oriented entrypoints (forbid `node:fs` and static `node:async_hooks`).
- Gate Node claims with a compiled `dist/` smoke under `node` (ALS + JSON line).

## Effects

- `tests/e2e/nest.e2e.test.ts`
- `usr/bin/check-edge-import`, `usr/bin/check-node-smoke`; wired into `make check`
- README HTTP adapters section documents Nest/Sails composition and the new gates

## Next

- Optional workerd AsyncLocalStorage.run fixture remains open if stronger than the import-graph check is required.

## Source

- `docs/issues/20261026074500_edge-workers-ci-fixture.md`
- `docs/issues/20261026114000_hot-path-and-http-adapters.md`
- User request to implement Nest note/e2e, Node/Edge smokes, and Sails README guidance
