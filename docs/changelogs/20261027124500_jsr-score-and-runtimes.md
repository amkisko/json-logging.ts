# JSR score and runtime matrix

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Soft-load AsyncLocalStorage through `process.getBuiltinModule` so the package has no static `node:async_hooks` import.
- Browsers and Cloudflare Workers without `nodejs_compat` may import for basic logging; ambient `withContext` / block tags are no-ops without ALS.
- Earn JSR documentation score items with `@module` docs on every entrypoint, README examples, and broader symbol JSDoc.
- Publish JSR from GitHub Actions with `id-token: write` so the package can receive provenance after the GitHub repo is linked in JSR settings.

## Effects

- Entrypoints under `src/` used by `jsr.json` exports carry `@module` (and examples where useful).
- `src/context.ts` resolves ALS at runtime via `process.getBuiltinModule`; `isAsyncLocalStorageAvailable()` reports whether ambient context works.
- README Runtime compatibility marks Node, Bun, Deno, Cloudflare Workers, and Browsers as compatible with ALS caveats.
- Bundle budget baseline raised to measured `54888` bytes after soft-load and docs growth.
- `.github/workflows/publish-jsr.yml` publishes on version tags; `usr/bin/release` publishes npm and pushes the tag for that workflow.

## Next

- After first publish: set JSR description, mark runtimes per README table, link the GitHub repository for OIDC.

## Source

- https://jsr.io/docs/scoring
- https://jsr.io/docs/writing-docs
- https://jsr.io/docs/packages
- User request to soft-load ALS for browsers and Workers without nodejs_compat
