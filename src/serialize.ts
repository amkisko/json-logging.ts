import { peekLogStore } from "./context.js";
import { isPlainObject, readObjectField } from "./objects.js";
import { applyCompiledRedactPaths, applyRedactPaths, type CompiledRedactPath } from "./redact.js";
import {
  prepareTags,
  sanitizeError,
  sanitizeHash,
  sanitizeString,
  sanitizeValue,
} from "./sanitize.js";
import { severityName } from "./severity.js";
import { currentTimestamp } from "./timestamp.js";
import type { ContextProvider, FieldSerializer, Level, LogMessage, LogRecord } from "./types.js";

export type { PerformanceLike } from "./timestamp.js";
export {
  currentTimestamp,
  defaultPerformance,
  formatTimestamp,
} from "./timestamp.js";

/** Reserved root keys; collisions from user fields move under `context`. */
export const SYSTEM_KEYS: ReadonlySet<string> = new Set([
  "tags",
  "severity",
  "timestamp",
  "message",
  "context",
]);

/** Normalize a log message into root fields (string, object, or Error). */
export function parseMessage(message: LogMessage): Record<string, unknown> {
  if (message instanceof Error) {
    return sanitizeError(message);
  }
  if (typeof message === "string") {
    return { message: sanitizeString(message) };
  }
  return mergeUserFields({}, message);
}

function mergeUserFields(
  payload: Record<string, unknown>,
  fields: Record<string, unknown>,
  alreadySanitized = false
): Record<string, unknown> {
  const source = alreadySanitized ? fields : sanitizeHash(fields);
  const conflicts: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "context" && isPlainObject(value)) {
      payload.context = {
        ...readObjectField(payload, "context"),
        ...value,
      };
      continue;
    }
    if (SYSTEM_KEYS.has(key) || key in payload) {
      conflicts[key] = value;
      continue;
    }
    payload[key] = value;
  }
  if (Object.keys(conflicts).length > 0) {
    payload.context = {
      ...readObjectField(payload, "context"),
      ...conflicts,
    };
  }
  return payload;
}

/** Inputs for {@link buildRecord} on the log hot path. */
export type BuildLineInput = {
  message: LogMessage;
  level: Level;
  stickyTags: readonly string[];
  base?: Record<string, unknown>;
  /** When true, base was sanitized at Logger construction. */
  preparedBase?: boolean;
  /** When true, stickyTags were prepared at Logger construction. */
  preparedTags?: boolean;
  clock?: () => Date;
  redact?: readonly string[];
  compiledRedact?: readonly CompiledRedactPath[];
  serializers?: Readonly<Record<string, FieldSerializer>>;
  contextProvider?: ContextProvider;
};

function applySerializers(
  payload: Record<string, unknown>,
  serializers: Readonly<Record<string, FieldSerializer>>
): void {
  for (const key of Object.keys(serializers)) {
    if (!Object.hasOwn(payload, key)) {
      continue;
    }
    const serialize = serializers[key];
    if (typeof serialize !== "function") {
      continue;
    }
    payload[key] = serialize(payload[key]);
  }
}

function mergeProviderContext(payload: Record<string, unknown>, provider: ContextProvider): void {
  const provided = provider();
  if (!provided) {
    return;
  }
  const sanitized = sanitizeHash(provided);
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(sanitized)) {
    if (SYSTEM_KEYS.has(key)) {
      continue;
    }
    filtered[key] = value;
  }
  if (Object.keys(filtered).length === 0) {
    return;
  }
  // Call-site / message context wins over provider.
  payload.context = {
    ...filtered,
    ...readObjectField(payload, "context"),
  };
}

/** Assemble one log record: message, severity, tags, context, serializers, redact. */
export function buildRecord(input: BuildLineInput): LogRecord {
  const payload: Record<string, unknown> = {};
  if (input.base && Object.keys(input.base).length > 0) {
    mergeUserFields(payload, input.base, input.preparedBase === true);
  }
  const parsed = parseMessage(input.message);
  for (const [key, value] of Object.entries(parsed)) {
    if (key === "context" && isPlainObject(value)) {
      payload.context = {
        ...readObjectField(payload, "context"),
        ...value,
      };
      continue;
    }
    payload[key] = value;
  }

  payload.severity = severityName(input.level);
  payload.timestamp = currentTimestamp(input.clock);

  const store = peekLogStore();
  if (input.stickyTags.length > 0 || store.tags.length > 0) {
    const sticky = input.preparedTags ? [...input.stickyTags] : prepareTags(input.stickyTags);
    const tags = uniqueTags([...sticky, ...prepareTags(store.tags)]);
    if (tags.length > 0) {
      payload.tags = tags;
    }
  }

  const context = store.context;
  if (context) {
    let hasContext = false;
    for (const _key in context) {
      hasContext = true;
      break;
    }
    if (hasContext) {
      const sanitizedContext = sanitizeHash(context);
      const filtered: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(sanitizedContext)) {
        if (SYSTEM_KEYS.has(key)) {
          continue;
        }
        filtered[key] = value;
      }
      if (Object.keys(filtered).length > 0) {
        payload.context = {
          ...filtered,
          ...readObjectField(payload, "context"),
        };
      }
    }
  }

  if (input.contextProvider) {
    mergeProviderContext(payload, input.contextProvider);
  }

  if (input.serializers) {
    let hasSerializers = false;
    for (const _key in input.serializers) {
      hasSerializers = true;
      break;
    }
    if (hasSerializers) {
      applySerializers(payload, input.serializers);
    }
  }

  if (input.compiledRedact && input.compiledRedact.length > 0) {
    const redacted = applyCompiledRedactPaths(payload, input.compiledRedact);
    if (isPlainObject(redacted)) {
      for (const key of Object.keys(payload)) {
        delete payload[key];
      }
      Object.assign(payload, redacted);
    }
  } else if (input.redact && input.redact.length > 0) {
    const redacted = applyRedactPaths(payload, input.redact);
    if (isPlainObject(redacted)) {
      for (const key of Object.keys(payload)) {
        delete payload[key];
      }
      Object.assign(payload, redacted);
    }
  }

  return payload;
}

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/** Serialize a record to one JSON line with a trailing newline. */
export function toJsonLine(record: LogRecord): string {
  const seen = new WeakSet<object>();
  const safe = sanitizeValue(record, 0, seen);
  return `${JSON.stringify(safe)}\n`;
}

/** Never-raise fallback record when the primary emit path throws. */
export function buildFallbackRecord(
  level: Level,
  message: unknown,
  error: unknown,
  clock?: () => Date
): LogRecord {
  const err =
    error instanceof Error ? error : new Error(typeof error === "string" ? error : "unknown");
  return {
    timestamp: currentTimestamp(clock),
    severity: severityName(level),
    message: sanitizeString(
      typeof message === "string"
        ? message
        : message instanceof Error
          ? message.message
          : "<unprintable>"
    ),
    logger_error: {
      name: sanitizeString(err.name),
      message: sanitizeString(String(err.message ?? "")),
    },
  };
}
