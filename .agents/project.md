## Shared instructions

- Product: `json-logging` TypeScript package for Bun, Node, Next.js, and Remix.
- Goal: ActiveSupport-style JSON logging experience (`JsonLogging.new`, `tagged`, `withContext`) with minimum configuration and zero runtime dependencies beyond the host runtime.
- Quality gates (via `make check` / `make ci`): Biome format and lint (`biome.json`), 100% test coverage, 100% type coverage, mutation score, LOC max 300, bundle size budget in `usr/budgets/bundle.json`, bench ceilings in `usr/budgets/bench.json`, dependency audit, prose checks, example smoke.
- Prefer `AsyncLocalStorage` for request/context tags when the runtime exposes it via `process.getBuiltinModule`; soft-load so browsers and Workers without Node builtins can still import for basic logging. Edge-safe sinks must fall back without crashing.
- Do not add pino/winston/bunyan as dependencies; this package is the thin structured layer.
- Fact-check ecosystem claims before README assertions; record evidence under `docs/`.
- Release with `make release VERSION=x.y.z` (`usr/bin/release`); dry-run with `DRY_RUN=1`. Publishes npmjs locally and tags for JSR GitHub Actions provenance publish; keep `package.json` and `jsr.json` versions aligned.
- JSR package settings: description from `package.json`; mark Node.js, Bun, Deno, Cloudflare Workers, and Browsers compatible (ALS only where builtins exist).

