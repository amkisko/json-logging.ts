/**
 * Bun / Node entry pattern: make logger + console.* emit structured JSON.
 *
 * Run: bun examples/bun-entry.ts
 */

import { installStructuredLogging } from "../src/console.js";
import { withContext } from "../src/index.js";

const { logger, uninstall } = installStructuredLogging({
  base: { service: "bun-demo" },
});

logger.info("app started");
console.log("legacy library style log");
console.warn({ event: "slow", duration_ms: 120 });

await withContext({ requestId: "req-1" }, async () => {
  console.info("inside request");
  logger.tagged("billing").info("charged");
});

uninstall();
