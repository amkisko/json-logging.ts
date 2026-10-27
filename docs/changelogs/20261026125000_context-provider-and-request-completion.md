# Context provider and request completion

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Adopt Experimental RFC-0004 for survey phase-1 improvements.
- Sanitize logger `base` and sticky `tags` once at construction.
- Add optional `contextProvider`, `logRequestCompletion`, adapter `logCompletion`, and `headersAllowlist`.

## Effects

- `LoggerOptions.contextProvider` merges under `context` after ALS; call-site wins; throw uses never-raise fallback.
- `./http` exports `logRequestCompletion` and allowlist helpers.
- Express, Hono, Koa, Fastify, and Bun adapters accept `logCompletion` and `headersAllowlist`.
- Bench scenarios `sticky-base-info` and `context-provider` gated in `usr/budgets/bench.json`.

## Next

- Calibrate ceilings on CI runners; consider Next/Remix `logCompletion`.
- Claims-audit before README asserts Lambda/Workers object-vs-string sink behavior.

## Source

- `rfcs/0004-context-provider-and-request-completion.md`
- `docs/plans/20261026115000_cross-language-json-logging-survey.md`
- `docs/issues/20261026114000_hot-path-and-http-adapters.md`
