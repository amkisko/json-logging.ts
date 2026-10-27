# CHANGELOG

## 0.1.1 (2026-10-27)

- Document remaining public symbols so JSR docs coverage clears the score threshold
- Sync the JSR package description from `package.json` via `usr/bin/sync-jsr-settings`

## 0.1.0 (2026-10-27)

- Ship structured JSON logging with `JsonLogging.new` / `createLogger`, severity methods, `tagged`, and `withContext`
- Add opt-in `installConsoleBridge` and `installStructuredLogging` under `./console`
- Add HTTP adapters for Hono, Express, Fastify, Koa, Bun.serve, Next.js, and Remix
- Add `isLevelEnabled`, path `redact`, and root `serializers`
- Add optional `contextProvider` so ambient fields join every log line without per-call context
- Add opt-in HTTP request completion lines and header allowlist for adapters
- Sanitize sticky `base` and tags once when the logger is created
- Soft-load AsyncLocalStorage so browsers and Workers without Node builtins can import for basic logging
- Document runtime compatibility for Node, Bun, Deno, Cloudflare Workers, and browsers
- Publish the package to both npmjs and jsr.io on release
- Publish JSR from GitHub Actions with OIDC provenance on version tags
- Add CI end-to-end adapter tests against real Hono, Express, Fastify, Koa, Bun.serve, Next.js `NextRequest`, Remix `createRequestHandler`, and NestJS Express/Fastify composition
- Add Node runtime smoke and Edge import-graph check; document Nest and Sails composition without new exports
