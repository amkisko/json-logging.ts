/**
 * Next.js helpers: wrap middleware or route handlers with request-scoped log context.
 *
 * @example
 * ```ts
 * import { withRequestLogging } from "@amkisko/json-logging/next";
 * import { httpLogger } from "@amkisko/json-logging/http";
 *
 * export default withRequestLogging(async (req) => {
 *   httpLogger().info({ path: req.nextUrl?.pathname });
 * });
 * ```
 *
 * @module
 */

import { bindLoggerFromOptions } from "./http-ambient.js";
import {
  allocateRequestId,
  defaultRandomId,
  fallbackRequestId,
  type WithHttpContextOptions,
  withHttpContext,
} from "./http-context.js";
import type { Logger } from "./logger.js";
import type { LoggerOptions } from "./types.js";

/** Minimal Next request shape used by the wrapper (no Next runtime dependency). */
export type RequestLike = {
  headers: Headers;
  method?: string;
  url?: string;
  nextUrl?: { pathname?: string };
};

/** Options for {@link withRequestLogging}. */
export type WithRequestLoggingOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
};

export { allocateRequestId, defaultRandomId, fallbackRequestId };

/**
 * Wrap a Next.js middleware or route handler with request-scoped context.
 * Bind loggers via `@amkisko/json-logging/http` (`bindHttpLogger` / `httpLogger`).
 */
export function withRequestLogging<TArgs extends unknown[], TResult>(
  handler: (request: RequestLike, ...rest: TArgs) => TResult | Promise<TResult>,
  options: WithRequestLoggingOptions = {}
): (request: RequestLike, ...rest: TArgs) => Promise<TResult> {
  bindLoggerFromOptions(options);
  return async (request: RequestLike, ...rest: TArgs): Promise<TResult> => {
    return (await withHttpContext(
      {
        headers: request.headers,
        method: request.method,
        url: request.url,
        path: request.nextUrl?.pathname,
      },
      () => handler(request, ...rest),
      options as WithHttpContextOptions
    )) as TResult;
  };
}
