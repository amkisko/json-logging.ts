# Public release readiness audit

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Verdict: not ready to publish a public 0.1.0 yet. Local quality gates are green; supply-chain and publication surfaces are not.
- Pipeline for this tree is ingress (log call / HTTP adapter) -> app logic (sanitize, redact, serialize) -> egress (sink). No product cache, database, queue, worker, or external API plant.
- Boundary and control mode skipped: library with no external device, operator plant, or physical actuator.
- Product surface skipped: no person-facing UI.
- Observability mode skipped: package has no long-lived service of its own.
- Learned systems skipped: no model or agent runtime.
- Security companions skipped with reason: http-identity, client-surface, native-interface, cloud-deployment, protocols-messaging, availability-abuse, data-isolation, local-application (no matching surface). Supply-chain-release ran.

## Effects

Observed this run:

- `make ci` exit 0: Biome clean, typecheck ok, type-coverage 3074/3074 (100% strict), 134 tests pass, coverage lines/funcs 100%, mutation 4/4 killed, dependency audit ok (zero runtime deps), LOC hard max 300 pass with soft warnings, bundle dist-js 54888/60000 bytes, example smoke ok, eight bench scenarios under ceilings on runner_class bun-local.
- `npx jsr publish --dry-run --allow-dirty` succeeded (source tree publish shape).
- `npm pack --dry-run`: 53 files, ~24.5 kB packed; includes README.md and LICENSE.md; does not include CHANGELOG.md.
- `npm view @amkisko/json-logging` -> 404 (not on npmjs).
- `https://jsr.io/@amkisko/json-logging` -> 404.
- `gh repo view amkisko/json-logging.ts` -> repository does not resolve.
- Local git: branch main with no commits; worktree fully untracked; no `git remote`.
- `package.json` / `jsr.json` version both 0.1.0; product CHANGELOG.md still entirely under Unreleased.
- Sensitive-key probe: `cookie`, `Cookie`, `session`, `Session`, `set-cookie`, `bearer` -> false; `author`, `authority` -> true (substring `auth`); credential-shaped names such as `password`, `csrf_token`, `private_key` -> true.
- Open live-work notes still list Edge/Workers CI fixture and bench CI calibration as Next.
- RFCs 0002, 0003, 0004 remain Status Experimental; acceptable for a 0.1.0 if marketed as such.

## Next

Done since this audit:

- CHANGELOG.md frozen as `0.1.0 (2026-10-27)` (`docs/changelogs/20261027180000_release-0-1-0.md`).
- Node runtime smoke and Edge import-graph check landed (`docs/changelogs/20261027163000_nest-node-edge-smokes.md`).

Publication blockers (do before first public tag):

1. Create initial commit(s) and push to `origin` (`https://github.com/amkisko/json-logging.ts`; public repo, topics, and default-branch ruleset already set).
2. Create npm scope/package `@amkisko/json-logging` and JSR package; link GitHub repo in JSR settings for OIDC provenance before relying on `publish-jsr.yml`.
3. Confirm npm publish auth for `usr/bin/release` (interactive confirm already present).

Still open for honest first public claims:

4. Decide sensitive-key contract for `cookie` / `session` / `set-cookie` (missing) and `author` / `authority` false positives; document or tighten before promising default redaction safety.
5. Calibrate `usr/budgets/bench.json` ceilings on the CI runner class (issue Next already names this).

Non-blocking for 0.1.0 experimental:

6. Soft LOC target (>150) warnings on several src/tests files; hard 300 still holds.
7. Mutation harness covers four intentional mutants only; do not read 4/4 as broad mutation assurance.
8. Optional: include CHANGELOG.md in the npm pack (npm special-file inclusion did not pick it up under current `files`).
9. Optional: declare `engines` if Node version floor is a contract.

## Source

- make ci (this session)
- npx jsr publish --dry-run --allow-dirty
- npm pack --dry-run; npm view @amkisko/json-logging
- gh repo view amkisko/json-logging.ts
- git status (no commits on main)
- README.md runtime table; CHANGELOG.md; package.json; jsr.json; usr/bin/release; .github/workflows/*
- src/sanitize.ts SENSITIVE_KEY_PATTERN
- docs/issues/20261026074500_edge-workers-ci-fixture.md
- docs/issues/20261026114000_hot-path-and-http-adapters.md
- docs/reviews/20261026074000_claims-audit.md
