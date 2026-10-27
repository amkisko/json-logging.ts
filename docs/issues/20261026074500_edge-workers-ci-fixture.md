# Edge and Workers CI fixture

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Core and next/remix helpers stay Web-API oriented.
- Gate Edge-oriented entrypoints with `make edge-import` (static import graph; no forbidden Node builtins; no static `node:async_hooks`).
- Keep documenting ALS via `process.getBuiltinModule` / Workers `nodejs_compat` in README.

## Effects

- `usr/bin/check-edge-import` walks `src/next.ts`, `src/remix.ts`, `src/hono.ts`, `src/http.ts`, `src/index.ts`, `src/console.ts` and their relative imports.
- Wired into `make check` / `make ci`.

## Next

- Optional workerd fixture for AsyncLocalStorage.run with console JSON sink (stronger than import-graph only).

## Source

- docs/plans/20261026072501_api-design-sketch.md
- docs/reviews/20261026074000_claims-audit.md
- docs/changelogs/20261027163000_nest-node-edge-smokes.md
