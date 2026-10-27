import { Logger } from "./logger.js";
import type { LoggerOptions } from "./types.js";

/** Create a {@link Logger} with optional level, sink, base fields, redact, and serializers. */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

/** ActiveSupport-style factory: `JsonLogging.new(options)` mirrors {@link createLogger}. */
export const JsonLogging: {
  new: (options?: LoggerOptions) => Logger;
} = {
  new(options: LoggerOptions = {}): Logger {
    return createLogger(options);
  },
};
