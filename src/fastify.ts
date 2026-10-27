/**
 * Fastify route-handler wrap for request-scoped log context (and optional completion).
 *
 * @example
 * ```ts
 * import { withFastifyLogging } from "@amkisko/json-logging/fastify";
 * app.get("/", withFastifyLogging(async (req, reply) => reply.send("ok")));
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

/** Minimal Fastify request shape (no Fastify runtime dependency). */
export type FastifyRequestLike = {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
};

/** Minimal Fastify reply shape. */
export type FastifyReplyLike = {
  statusCode?: number;
};

/** Options for {@link withFastifyLogging}. */
export type WithFastifyLoggingOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  headersAllowlist?: readonly string[];
  logCompletion?: boolean;
};

/**
 * Wrap a Fastify route handler so ALS context covers the handler body.
 * Bind loggers via `./http`.
 */
export function withFastifyLogging<
  TRequest extends FastifyRequestLike,
  TReply extends FastifyReplyLike,
  TResult,
>(
  handler: (this: unknown, request: TRequest, reply: TReply) => TResult | Promise<TResult>,
  options: WithFastifyLoggingOptions = {}
): (this: unknown, request: TRequest, reply: TReply) => Promise<TResult> {
  bindLoggerFromOptions(options);
  const headerName = options.headerName ?? "x-request-id";
  return async function (this: unknown, request: TRequest, reply: TReply): Promise<TResult> {
    const input = {
      method: request.method,
      url: request.url,
      headers: request.headers,
    };
    const started = Date.now();
    const fields = httpFieldsFrom(input, headerName);
    let error: unknown;
    try {
      return (await withHttpContext(
        input,
        () => handler.call(this, request, reply),
        options as WithHttpContextOptions
      )) as TResult;
    } catch (caught) {
      error = caught;
      throw caught;
    } finally {
      if (options.logCompletion) {
        const logger = options.logger ?? getAmbientHttpLogger();
        if (logger) {
          logRequestCompletion(logger, {
            method: typeof fields.method === "string" ? fields.method : undefined,
            path: typeof fields.path === "string" ? fields.path : undefined,
            status: typeof reply.statusCode === "number" ? reply.statusCode : 0,
            elapsedMs: Date.now() - started,
            error,
          });
        }
      }
    }
  };
}
