/**
 * Next.js App Router pattern (copy into instrumentation.ts / middleware).
 *
 * What this covers:
 * - installStructuredLogging once at process start (instrumentation register)
 * - withRequestLogging on middleware for requestId context
 * - bindHttpLogger so httpLogger() shares the same instance
 *
 * What this does NOT cover:
 * - Next.js own compiler/dev overlay logs
 * - Middleware ALS continuing into a later Node route handler (forward x-request-id)
 * - Libraries that write to process.stdout without console
 */

import { installStructuredLogging } from "../src/console.js";
import { bindHttpLogger, httpLogger } from "../src/http.js";
import type { Logger } from "../src/index.js";
import { withRequestLogging } from "../src/next.js";

let bootstrapped = false;
let bootLogger: Logger | undefined;

/** Call from instrumentation.ts `register()` on the Node runtime. */
export function registerStructuredLogging(): Logger {
  if (bootstrapped && bootLogger) {
    return bootLogger;
  }
  const { logger } = installStructuredLogging({
    base: { service: "next-app" },
  });
  bindHttpLogger(logger);
  bootLogger = logger;
  bootstrapped = true;
  return logger;
}

/** Test helper: clear module boot state. */
export function resetNextExampleForTests(): void {
  bootstrapped = false;
  bootLogger = undefined;
}

/** Example middleware default export shape. */
export const middleware = withRequestLogging(async (req) => {
  httpLogger().info({
    event: "middleware",
    path: req.nextUrl?.pathname ?? req.url,
  });
  // return NextResponse.next()
  return { ok: true, method: req.method };
});
