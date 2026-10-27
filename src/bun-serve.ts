/**
 * Bun.serve fetch-handler wrap for request-scoped log context (and optional completion).
 *
 * @example
 * ```ts
 * import { withBunLogging } from "@amkisko/json-logging/bun";
 * Bun.serve({ fetch: withBunLogging(async (req) => new Response("ok")) });
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

/** Minimal fetch Request shape used with Bun.serve. */
export type BunFetchRequest = {
  method: string;
  url: string;
  headers: Headers;
};

/** Options for {@link withBunLogging}. */
export type WithBunLoggingOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  headersAllowlist?: readonly string[];
  logCompletion?: boolean;
};

function responseStatus(value: unknown): number {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "status") === "number"
  ) {
    return Reflect.get(value, "status") as number;
  }
  return 200;
}

/** Wrap a `Bun.serve` fetch handler. Bind loggers via `./http`. */
export function withBunLogging<TArgs extends unknown[], TResult>(
  handler: (request: BunFetchRequest, ...rest: TArgs) => TResult | Promise<TResult>,
  options: WithBunLoggingOptions = {}
): (request: BunFetchRequest, ...rest: TArgs) => Promise<TResult> {
  bindLoggerFromOptions(options);
  const headerName = options.headerName ?? "x-request-id";
  return async (request: BunFetchRequest, ...rest: TArgs): Promise<TResult> => {
    const input = {
      method: request.method,
      url: request.url,
      headers: request.headers,
    };
    const started = Date.now();
    const fields = httpFieldsFrom(input, headerName);
    let error: unknown;
    let result: TResult | undefined;
    try {
      result = (await withHttpContext(
        input,
        () => handler(request, ...rest),
        options as WithHttpContextOptions
      )) as TResult;
      return result;
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
            status: error !== undefined ? 500 : responseStatus(result),
            elapsedMs: Date.now() - started,
            error,
          });
        }
      }
    }
  };
}
