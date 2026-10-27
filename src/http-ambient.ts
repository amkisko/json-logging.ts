import type { Logger } from "./logger.js";

let ambientLogger: Logger | undefined;

/** Set the process-wide ambient logger used by HTTP adapters. */
export function bindHttpLogger(logger: Logger): void {
  ambientLogger = logger;
}

/** Current ambient HTTP logger, if {@link bindHttpLogger} was called. */
export function getAmbientHttpLogger(): Logger | undefined {
  return ambientLogger;
}

/** Bind options.logger once when building an adapter factory. */
export function bindLoggerFromOptions(options?: { logger?: Logger }): void {
  if (options?.logger) {
    bindHttpLogger(options.logger);
  }
}

/** Test helper: clear the shared HTTP ambient logger. */
export function resetHttpLoggerForTests(): void {
  ambientLogger = undefined;
}
