/**
 * Remix / React Router server pattern (copy into server entry / handleRequest).
 *
 * What this covers:
 * - installStructuredLogging at server boot
 * - withRemixContext around each request
 * - console.* from loaders that run inside the ALS context
 *
 * What this does NOT cover:
 * - Vite / Remix CLI logs
 * - Browser console
 * - Libraries that bypass console
 */

import { installStructuredLogging } from "../src/console.js";
import { bindHttpLogger, httpLogger } from "../src/http.js";
import type { Logger } from "../src/index.js";
import { withRemixContext } from "../src/remix.js";

let logger: Logger | undefined;

export function bootRemixLogging(): Logger {
  if (logger) {
    return logger;
  }
  const installed = installStructuredLogging({
    base: { service: "remix-app" },
  });
  logger = installed.logger;
  bindHttpLogger(logger);
  return logger;
}

/** Test helper: clear module boot state. */
export function resetRemixExampleForTests(): void {
  logger = undefined;
}

export async function handleRequest(
  request: Request,
  context: Record<string, unknown> = {}
): Promise<Response> {
  bootRemixLogging();
  return withRemixContext({ request, context }, async () => {
    httpLogger().info({ event: "request", method: request.method });
    console.log("loader-style console log");
    return new Response("ok");
  });
}
