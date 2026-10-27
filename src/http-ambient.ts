import type { Logger } from "./logger.js";

let ambientLogger: Logger | undefined;

export function bindHttpLogger(logger: Logger): void {
  ambientLogger = logger;
}

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
