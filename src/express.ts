/**
 * Express middleware that attaches request context (and optional completion on `finish`).
 *
 * @example
 * ```ts
 * import { withExpressLogging } from "@amkisko/json-logging/express";
 * app.use(withExpressLogging({ logCompletion: true }));
 * ```
 *
 * @module
 */

import { bindLoggerFromOptions, getAmbientHttpLogger } from "./http-ambient.js";
import {
  httpFieldsFrom,
  logRequestCompletion,
  type WithHttpContextOptions,
  withHttpContext,
} from "./http-context.js";
import type { Logger } from "./logger.js";
import type { LoggerOptions } from "./types.js";

/** Minimal Express request shape (no Express runtime dependency). */
export type ExpressRequestLike = {
  method?: string;
  url?: string;
  originalUrl?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/** Minimal Express response shape. */
export type ExpressResponseLike = {
  statusCode?: number;
  on?: (event: string, listener: () => void) => unknown;
};

/** Options for {@link withExpressLogging}. */
export type WithExpressLoggingOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  headersAllowlist?: readonly string[];
  logCompletion?: boolean;
};

/** Express-style middleware function. */
export type ExpressMiddleware = (
  req: ExpressRequestLike,
  res: ExpressResponseLike,
  next: (error?: unknown) => void
) => void;

/**
 * Build Express middleware: `(req, res, next) => ...`.
 * Bind loggers via `@amkisko/json-logging/http`.
 */
export function withExpressLogging(options: WithExpressLoggingOptions = {}): ExpressMiddleware {
  bindLoggerFromOptions(options);
  const headerName = options.headerName ?? "x-request-id";
  return (req, res, next) => {
    const input = {
      method: req.method,
      url: req.originalUrl ?? req.url,
      headers: req.headers,
    };
    const started = Date.now();
    const fields = httpFieldsFrom(input, headerName);
    void withHttpContext(
      input,
      () => {
        if (options.logCompletion && typeof res.on === "function") {
          res.on("finish", () => {
            const logger = options.logger ?? getAmbientHttpLogger();
            if (!logger) {
              return;
            }
            logRequestCompletion(logger, {
              method: typeof fields.method === "string" ? fields.method : undefined,
              path: typeof fields.path === "string" ? fields.path : undefined,
              status: typeof res.statusCode === "number" ? res.statusCode : 0,
              elapsedMs: Date.now() - started,
            });
          });
        }
        next();
      },
      options as WithHttpContextOptions
    );
  };
}
