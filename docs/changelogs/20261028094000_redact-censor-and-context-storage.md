# Redact censor modes and injectable ALS

## Decisions

- Ship RFC-0005: `RedactOptions` (paths, keys, caseInsensitive, censor, hashLabel) and `configureContextStorage`.
- Keep array `redact: string[]` as path-only `[FILTERED]` for RFC-0002 callers.
- Soft-load ALS remains default; injection is opt-in for hosts that construct ALS themselves.
- Do not ship `llms.txt`; `README.md` is the single operational API map.
- Cut product notes as `0.2.0 (2026-10-28)` (new public surface after `0.1.1`).

## Effects

- `src/redact.ts` compiles a single plan; paths run then key walks; remove drops object keys and nulls array slots; hash uses FNV-1a hex8.
- `configureContextStorage` sets the same override slot as tests; `null` restores soft-load.
- Raised `usr/budgets/bundle.json` ceiling/baseline for the larger dist (intentional).
- `CHANGELOG.md`, `package.json`, and `jsr.json` set to `0.2.0`.
- Observed: `make release VERSION=0.2.0 DRY_RUN=1` exit 0 (`make ci` green, 162 tests, npm pack and `jsr publish --dry-run` valid).

## Next

- Commit the release tree, then `make release` for npmjs plus version tag / JSR CI.
- Whether sanitize sensitive-key defaults should honor logger censor (left open in RFC-0005).

## Source

- RFC-0005
- Follows unresolved question on RFC-0002 redact `{ paths, censor }`
