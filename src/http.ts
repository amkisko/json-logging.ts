/**
 * Shared HTTP helpers: ambient logger binding, request context, and completion lines.
 * Framework adapters live on separate entrypoints (`./hono`, `./express`, ...).
 *
 * @example
 * ```ts
 * import { bindHttpLogger, httpLogger, withHttpContext } from "@amkisko/json-logging/http";
 *
 * bindHttpLogger(httpLogger({ loggerOptions: { base: { service: "api" } } }));
 * await withHttpContext({ method: "GET", path: "/" }, () => {
 *   httpLogger().info("inside request");
 * });
 * ```
 *
 * @module
 */

import { bindHttpLogger, getAmbientHttpLogger } from "./http-ambient.js";
import type { WithHttpContextOptions } from "./http-context.js";
import { createLogger } from "./json-logging.js";
import type { Logger } from "./logger.js";

export {
  bindHttpLogger,
  bindLoggerFromOptions,
  resetHttpLoggerForTests,
} from "./http-ambient.js";
export type {
  HeaderBag,
  HttpRequestInput,
  RequestCompletionFields,
  WithHttpContextOptions,
} from "./http-context.js";
export {
  allocateRequestId,
  defaultRandomId,
  fallbackRequestId,
  httpFieldsFrom,
  isValidRequestId,
  logRequestCompletion,
  pickAllowlistedHeaders,
  pickContextKeys,
  REQUEST_ID_PATTERN,
  requestPathFromUrl,
  withHttpContext,
} from "./http-context.js";

/** Resolve the ambient HTTP logger, or create and bind one from options. */
export function httpLogger(options?: WithHttpContextOptions): Logger {
  if (options?.logger) {
    return options.logger;
  }
  const ambient = getAmbientHttpLogger();
  if (ambient) {
    return ambient;
  }
  const created = createLogger(options?.loggerOptions);
  bindHttpLogger(created);
  return created;
}
