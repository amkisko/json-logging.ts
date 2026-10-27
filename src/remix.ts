/**
 * Remix helpers: run handleRequest / loader bodies with request-scoped log context.
 *
 * @example
 * ```ts
 * import { withRemixContext } from "@amkisko/json-logging/remix";
 * import { httpLogger } from "@amkisko/json-logging/http";
 *
 * return withRemixContext({ request, context }, () => {
 *   httpLogger().info("loading");
 *   return handle(request);
 * });
 * ```
 *
 * @module
 */

import { bindLoggerFromOptions } from "./http-ambient.js";
import { pickContextKeys, type WithHttpContextOptions, withHttpContext } from "./http-context.js";
import type { Logger } from "./logger.js";
import type { LoggerOptions } from "./types.js";

/** Minimal Remix request shape (no Remix runtime dependency). */
export type RemixRequestLike = {
  method?: string;
  url?: string;
  headers?: Headers;
};

/** Load / app context bag passed into Remix. */
export type RemixContextBag = Record<string, unknown>;

/** Options for {@link withRemixContext}. */
export type WithRemixContextOptions = {
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  requestIdHeader?: string;
  /** Allowlisted keys copied from load context into log context. Default: none. */
  contextKeys?: readonly string[];
};

/**
 * Run a Remix handleRequest / middleware / loader body with ALS context.
 * Bind loggers via `@amkisko/json-logging/http` (`bindHttpLogger` / `httpLogger`).
 */
export function withRemixContext<T>(
  input: {
    request?: RemixRequestLike;
    context?: RemixContextBag;
  },
  fn: () => T | Promise<T>,
  options: WithRemixContextOptions = {}
): T | Promise<T> {
  bindLoggerFromOptions(options);
  const requestId = input.context?.requestId != null ? String(input.context.requestId) : undefined;
  return withHttpContext(
    {
      headers: input.request?.headers,
      method: input.request?.method,
      url: input.request?.url,
      requestId,
    },
    fn,
    {
      headerName: options.requestIdHeader,
      logger: options.logger,
      loggerOptions: options.loggerOptions,
      extra: pickContextKeys(input.context, options.contextKeys),
    } as WithHttpContextOptions
  );
}
