/**
 * Structured JSON logging with ActiveSupport-style `tagged` and `withContext`.
 *
 * @example
 * ```ts
 * import { createLogger, withContext } from "@amkisko/json-logging";
 *
 * const logger = createLogger({ base: { service: "api" } });
 * await withContext({ requestId: "abc" }, async () => {
 *   logger.info("handled request");
 * });
 * ```
 *
 * @module
 */

export type { ConsoleMethodName, ConsoleMethods } from "./console-state.js";
export {
  captureConsoleMethods,
  getBridgeOriginals,
  isInBridge,
} from "./console-state.js";
export type { AlsConstructor, AlsInstance, ContextFields } from "./context.js";
export {
  getBlockTags,
  getContext,
  isAsyncLocalStorageAvailable,
  peekLogStore,
  withContext,
} from "./context.js";
export { createLogger, JsonLogging } from "./json-logging.js";
export { Logger } from "./logger.js";
export type { CompiledRedactPath } from "./redact.js";
export {
  applyCompiledRedactPaths,
  applyRedactPaths,
  compileRedactPaths,
} from "./redact.js";
export {
  isSensitiveKey,
  MAX_CONTEXT_SIZE,
  MAX_DEPTH,
  MAX_STRING_LENGTH,
  prepareTags,
  sanitizeError,
  sanitizeHash,
  sanitizeString,
} from "./sanitize.js";
export {
  buildFallbackRecord,
  buildRecord,
  currentTimestamp,
  formatTimestamp,
  parseMessage,
  SYSTEM_KEYS,
  toJsonLine,
} from "./serialize.js";
export { isEnabled, LEVEL_ORDER, SEVERITY_NAMES, severityName } from "./severity.js";
export { consoleSink, consoleSinkFrom, streamSink } from "./sinks.js";
export type { PerformanceLike } from "./timestamp.js";
export { defaultPerformance } from "./timestamp.js";
export type {
  ContextProvider,
  FieldSerializer,
  JsonPrimitive,
  JsonValue,
  Level,
  LoggerOptions,
  LogMessage,
  LogRecord,
  SeverityName,
  Sink,
} from "./types.js";
