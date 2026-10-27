# Experiment notes: timestamps and sensitive keys

## Participants

Andrei Makarov (@amkisko)

## Decisions

- Prefer microsecond timestamps via `performance.timeOrigin + performance.now()` when no test clock is set; fall back to `Date.toISOString()` (milliseconds) when a clock is injected or performance is unavailable.
- Use a case-insensitive sensitive-key regex covering password, secret, token, authorization, api_key / api-key, and related credential patterns aligned with the Ruby gem fallback filter (without Rails ParameterFilter).

## Effects

- Microsecond path produces ISO8601 UTC with six fractional digits ending in `Z` under Bun.
- Clock injection keeps deterministic millisecond stamps in tests.
- Sensitive key samples (`password`, `access_token`, `Authorization`, `api_key`) redact to `[FILTERED]`; unrelated keys such as `user_name` pass through.

## Next

- Optional Edge import smoke that fails if `node:fs` or `worker_threads` resolve from `./next` entry remains open for CI.

## Source

- docs/plans/20261026072500_ecosystem-research.md section 8
- src/serialize.ts currentTimestamp
- src/sanitize.ts SENSITIVE_KEY_PATTERN
