# Next.js and Remix framework e2e

## Decisions

- Add `next`, `react`, `react-dom`, and `@remix-run/node` as development dependencies for CI only; keep published runtime dependencies empty.
- Prove Next helpers with a real `NextRequest` from `next/server` through `withRequestLogging` (ALS after await).
- Prove Remix helpers with a real `createRequestHandler` build whose loader logs under `withRemixContext` (data request).
- Do not require a full Next or Remix production app process in CI.

## Effects

- `tests/e2e/next-framework.e2e.test.ts` and `tests/e2e/remix-framework.e2e.test.ts`.
- README HTTP adapters section updated to name these APIs.
- Earlier Web Request surface tests under `tests/e2e/next-remix.e2e.test.ts` remain as a lighter duck-type check.

## Next

- Optional Edge/Workers import smoke remains separate (`docs/issues/20261026074500_edge-workers-ci-fixture.md`).

## Source

- `docs/changelogs/20261027152700_framework-adapter-e2e.md` Next item
- User request to continue after first e2e pass
