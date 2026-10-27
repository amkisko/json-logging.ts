/**
 * Koa middleware that attaches request context (and optional completion lines).
 *
 * @example
 * ```ts
 * import { withKoaLogging } from "@amkisko/json-logging/koa";
 * app.use(withKoaLogging({ logCompletion: true }));
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

/** Minimal Koa context shape (no Koa runtime dependency). */
export type KoaContextLike = {
  method: string;
  path?: string;
  url?: string;
  status?: number;
  get: (name: string) => string;
};

/** Options for {@link withKoaLogging}. */
export type WithKoaLoggingOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  headersAllowlist?: readonly string[];
  logCompletion?: boolean;
};

/** Koa-style middleware function. */
export type KoaMiddleware = (ctx: KoaContextLike, next: () => Promise<void>) => Promise<void>;

/** Build Koa middleware: `(ctx, next) => ...`. Bind loggers via `./http`. */
export function withKoaLogging(options: WithKoaLoggingOptions = {}): KoaMiddleware {
  bindLoggerFromOptions(options);
  const headerName = options.headerName ?? "x-request-id";
  return async (ctx, next) => {
    const existing = ctx.get(headerName);
    const input = {
      method: ctx.method,
      path: ctx.path,
      url: ctx.url,
      requestId: existing.length > 0 ? existing : undefined,
      headers: {
        get: (name: string) => {
          const value = ctx.get(name);
          return value.length > 0 ? value : null;
        },
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
                status: typeof ctx.status === "number" ? ctx.status : 0,
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
