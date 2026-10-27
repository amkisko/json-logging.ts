import { plainObjectFrom } from "./objects.js";
import type { JsonValue } from "./types.js";

/** Maximum string length kept after sanitization (longer values are truncated). */
export const MAX_STRING_LENGTH = 10_000;
/** Maximum number of keys kept in a sanitized object. */
export const MAX_CONTEXT_SIZE = 50;
/** Maximum nesting depth when sanitizing structured values. */
export const MAX_DEPTH = 10;
/** Maximum stack frames kept on sanitized Error backtraces. */
export const MAX_BACKTRACE_LINES = 20;

const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

/** Case-insensitive sensitive key names (password, secret, token, authorization, api_key, ...). */
export const SENSITIVE_KEY_PATTERN =
  /(passw|pwd|secret|token|authorization|auth|api[_-]?key|_key$|crypt|salt|certificate|otp|ssn|cvv|cvc|credential)/i;

const FILTERED = "[FILTERED]";
const CIRCULAR = "[Circular]";

/** True when a key name matches {@link SENSITIVE_KEY_PATTERN}. */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

/** Strip control characters and truncate to {@link MAX_STRING_LENGTH}. */
export function sanitizeString(value: string): string {
  try {
    let result = value.replace(CONTROL_CHARS, "");
    if (result.length > MAX_STRING_LENGTH) {
      result = `${result.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
    }
    return result;
  } catch {
    return "<sanitization_error>";
  }
}

/** Coerce tags to non-empty sanitized strings, dropping nullish entries. */
export function prepareTags(tags: readonly unknown[]): string[] {
  const prepared: string[] = [];
  for (const tag of tags) {
    if (tag === null || tag === undefined) {
      continue;
    }
    const text = sanitizeString(String(tag));
    if (text.length > 0) {
      prepared.push(text);
    }
  }
  return prepared;
}

/** Shape an Error under an `error` key for log payloads (name, message, stack, cause). */
export function sanitizeError(error: Error): { [key: string]: JsonValue } {
  try {
    const body: { [key: string]: JsonValue } = {
      name: sanitizeString(error.name || "Error"),
      message: sanitizeString(String(error.message ?? "")),
    };
    if (typeof error.stack === "string" && error.stack.length > 0) {
      body.stack = sanitizeBacktrace(error.stack);
    }
    const cause = Reflect.get(error, "cause");
    if (cause !== undefined) {
      body.cause = sanitizeValue(cause, 0, new WeakSet());
    }
    return { error: body };
  } catch {
    return {
      error: { name: "Error", message: "<sanitization_failed>" },
    };
  }
}

function sanitizeBacktrace(stack: string): string {
  const lines = stack.split("\n").slice(0, MAX_BACKTRACE_LINES);
  return sanitizeString(lines.join("\n"));
}

export function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): JsonValue {
  try {
    if (value === null) {
      return null;
    }
    if (value === undefined) {
      return null;
    }
    if (typeof value === "string") {
      return sanitizeString(value);
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : String(value);
    }
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "bigint") {
      return value.toString();
    }
    if (typeof value === "symbol") {
      return sanitizeString(String(value));
    }
    if (typeof value === "function") {
      return sanitizeString(`[Function ${value.name || "anonymous"}]`);
    }
    if (value instanceof Error) {
      return sanitizeError(value);
    }
    if (depth > MAX_DEPTH) {
      return { error: "max_depth_exceeded" };
    }
    // Remaining values are objects (null already returned above).
    if (seen.has(value)) {
      return CIRCULAR;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      return sanitizeArray(value, depth, seen);
    }
    return sanitizeObject(plainObjectFrom(value), depth, seen);
  } catch {
    return "<unprintable>";
  }
}

function sanitizeArray(value: unknown[], depth: number, seen: WeakSet<object>): JsonValue[] {
  const limited = value.slice(0, MAX_CONTEXT_SIZE);
  const result: JsonValue[] = limited.map((item) => sanitizeValue(item, depth + 1, seen));
  if (value.length > MAX_CONTEXT_SIZE) {
    result.push("[truncated]");
  }
  return result;
}

function sanitizeObject(
  value: { [key: string]: unknown },
  depth: number,
  seen: WeakSet<object>
): { [key: string]: JsonValue } {
  const result: { [key: string]: JsonValue } = {};
  const keys = Object.keys(value).slice(0, MAX_CONTEXT_SIZE);
  for (const key of keys) {
    if (isSensitiveKey(key)) {
      result[key] = FILTERED;
      continue;
    }
    result[key] = sanitizeValue(value[key], depth + 1, seen);
  }
  if (Object.keys(value).length > MAX_CONTEXT_SIZE) {
    result.__truncated__ = true;
  }
  return result;
}

/** Sanitize a plain object: filter sensitive keys, bound depth/size, mark cycles. */
export function sanitizeHash(hash: Record<string, unknown>, depth = 0): Record<string, unknown> {
  try {
    if (depth > MAX_DEPTH) {
      return { error: "max_depth_exceeded" };
    }
    return sanitizeObject(hash, depth, new WeakSet());
  } catch {
    return { sanitization_error: true };
  }
}
