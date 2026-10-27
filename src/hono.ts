/**
 * Hono middleware that attaches request context (and optional completion lines).
 *
 * @example
 * ```ts
 * import { withHonoLogging } from "@amkisko/json-logging/hono";
 * app.use(withHonoLogging({ logCompletion: true }));
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

/** Minimal Hono context shape (no Hono runtime dependency). */
export type HonoContextLike = {
  req: {
    method: string;
    url: string;
    header: (name: string) => string | undefined;
  };
  res?: { status: number };
};

/** Options for {@link withHonoLogging}. */
export type WithHonoLoggingOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  headersAllowlist?: readonly string[];
  logCompletion?: boolean;
};

/** Hono-style middleware function. */
export type HonoMiddleware = (c: HonoContextLike, next: () => Promise<void>) => Promise<void>;

/** Build Hono middleware: `(c, next) => ...`. Bind loggers via `./http`. */
export function withHonoLogging(options: WithHonoLoggingOptions = {}): HonoMiddleware {
  bindLoggerFromOptions(options);
  const headerName = options.headerName ?? "x-request-id";
  return async (c, next) => {
    const existing = c.req.header(headerName) ?? null;
    const input = {
      method: c.req.method,
      url: c.req.url,
      requestId: existing ?? undefined,
      headers: {
        get: (name: string) => c.req.header(name) ?? null,
      },
    };
    const started = Date.now();
    const fields = httpFieldsFrom(input, headerName);
    await withHttpContext(
      input,
      async () => {
        try {
          await next();
        } finally {
          if (options.logCompletion) {
            const logger = options.logger ?? getAmbientHttpLogger();
            if (logger) {
              logRequestCompletion(logger, {
                method: typeof fields.method === "string" ? fields.method : undefined,
                path: typeof fields.path === "string" ? fields.path : undefined,
                status: c.res?.status ?? 0,
                elapsedMs: Date.now() - started,
              });
            }
          }
        }
      },
      options as WithHttpContextOptions
    );
  };
}
