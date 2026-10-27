# House structure alignment

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Match sibling amkisko library root hygiene for a TypeScript package: `.gitignore` with `.pray`, Biome quality gate, root `CHANGELOG.md` and `LICENSE.md`, `kisko.svg`, markdownlint, and GitHub templates/workflows used across gems.

## Effects

- Added `biome.json` and `make lint-biome` (pinned `@biomejs/biome@2.3.8` via npx, same pattern as `activeadmin_command_palette.rb`).
- Expanded `.gitignore`, renamed `LICENSE` to `LICENSE.md`, added `CHANGELOG.md`, `.markdownlint.yaml`, and `kisko.svg`.
- Added `.github` Dependabot, funding, PR/issue templates, Scorecard, and Bun-backed dependency-audit workflow beside existing `ci.yml`.
- Documented Biome and bench ceilings in README and `.agents/project.md`.

## Next

- Run `make format` once after Biome first fail if auto-fix is needed; keep `make check` green.
- Consider Codecov/Sonar later when the published GitHub repo needs the same badges as Ruby gems.

## Source

- User request to align repository structure with other libraries
- `activeadmin_command_palette.rb` Biome Makefile target
- `activesupport-json_logging.rb` GitHub workflow and root file set
