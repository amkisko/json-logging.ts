# Dual registry publish

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Publish each release to both npmjs and jsr.io under `@amkisko/json-logging`.
- npm ships compiled `dist` from `package.json`; JSR ships TypeScript under `src` from `jsr.json` with the same subpath exports.

## Effects

- Added `jsr.json` with matching entrypoints (`.` through `./bun`).
- `usr/bin/release` requires matching versions in `package.json` and `jsr.json`, dry-runs `npm pack` and `jsr publish`, then publishes both registries before tagging.
- README documents npm and JSR install commands.

## Next

- Create `@amkisko` scope and `json-logging` package on jsr.io before the first real JSR publish.
- Link the GitHub repository in JSR package settings when the remote exists, for OIDC CI publish later if desired.

## Source

- https://jsr.io/docs/publishing-packages
- User request to publish to npmjs and jsr.io
