# Makefile and quality gate alignment

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Align repository layout with sibling amkisko libraries: Makefile entrypoints and `usr/bin/` maintainer scripts including `release`.
- Gate CI on coverage 100%, type coverage 100%, mutation score, LOC maximum 300, bundle size budget, dependency audit, prose checks, and example smoke.
- Keep zero runtime dependencies; mutation uses a small hand-rolled suite like pray_compat trees rather than adding Stryker.

## Effects

- Added Makefile, `.github/workflows/ci.yml`, `usr/bin/{release,mutation,check-loc,check-bundle-size,check-example,check-text,audit-dependencies}`, and `usr/budgets/bundle.json`.
- Prayfile composes `delivery-budgets`.
- package.json `check` / `ci` scripts delegate to Make.

## Next

- Update `baseline_bytes` in the bundle budget when intentional size growth ships.
- Wire Codecov or Sonar later if the published GitHub repo needs the same badges as the Ruby gems.

## Source

- User request to align structure and quality gates with other repositories
- pray_compat Makefile and usr/bin patterns
