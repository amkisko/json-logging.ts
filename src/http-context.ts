import { withContext } from "./context.js";
import type { Logger } from "./logger.js";
import { sanitizeError, sanitizeString } from "./sanitize.js";
import type { LoggerOptions } from "./types.js";

export type HeaderBag = {
  get(name: string): string | null;
};

export type HttpRequestInput = {
  method?: string;
  url?: string;
  path?: string;
  headers?: HeaderBag | Record<string, string | string[] | undefined>;
  requestId?: string;
};

export type WithHttpContextOptions = {
  headerName?: string;
  logger?: Logger;
  loggerOptions?: LoggerOptions;
  /** Optional allowlisted fields merged under http fields (http fields win). */
  extra?: Record<string, unknown>;
  /**
   * Copy these request header names into ALS context (sanitized strings).
   * Listing Authorization or Cookie is an explicit risk; default is none.
   */
  headersAllowlist?: readonly string[];
  /** When true, adapters emit one completion line after the request. */
  logCompletion?: boolean;
};

export type RequestCompletionFields = {
  method?: string;
  path?: string;
  status: number;
  elapsedMs: number;
  error?: unknown;
};

/** Accept inbound request ids that are short and correlation-safe. */
export const REQUEST_ID_PATTERN = /^[\w.\-:]{1,128}$/;

let fallbackCounter = 0;

export function fallbackRequestId(now: () => number = Date.now): string {
  fallbackCounter += 1;
  return `req_${now().toString(36)}_${fallbackCounter.toString(36)}`;
}

export function defaultRandomId(randomUUID?: (() => string) | null): string {
  const resolved =
    randomUUID === undefined ? globalThis.crypto?.randomUUID?.bind(globalThis.crypto) : randomUUID;
  if (typeof resolved === "function") {
    return resolved();
  }
  return fallbackRequestId();
}

export function isValidRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value);
}

export function allocateRequestId(
  existing: string | null | undefined,
  randomId: () => string = defaultRandomId
): string {
  if (existing && isValidRequestId(existing)) {
    return existing;
  }
  try {
    return randomId();
  } catch {
    return fallbackRequestId();
  }
}

export function requestPathFromUrl(url: string): string | undefined {
  if (url.length === 0) {
    return undefined;
  }
  try {
    return new URL(url, "http://localhost").pathname;
  } catch {
    const query = url.indexOf("?");
    const hash = url.indexOf("#");
    let end = url.length;
    if (query >= 0) {
      end = query;
    }
    if (hash >= 0 && hash < end) {
      end = hash;
    }
    const path = url.slice(0, end);
    return path.length > 0 ? path : undefined;
  }
}

function isHeaderBag(value: object): value is HeaderBag {
  return typeof Reflect.get(value, "get") === "function";
}

function headerGet(
  headers: HeaderBag | Record<string, string | string[] | undefined> | undefined,
  name: string
): string | null {
  if (!headers) {
    return null;
  }
  if (isHeaderBag(headers)) {
    return headers.get(name);
  }
  const direct = Reflect.get(headers, name) ?? Reflect.get(headers, name.toLowerCase());
  if (Array.isArray(direct)) {
    const first = direct[0];
    return typeof first === "string" ? first : null;
  }
  return typeof direct === "string" ? direct : null;
}

export function pickContextKeys(
  bag: Record<string, unknown> | undefined,
  keys: readonly string[] | undefined
): Record<string, unknown> {
  if (!bag || !keys || keys.length === 0) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(bag, key)) {
      out[key] = bag[key];
    }
  }
  return out;
}

export function httpFieldsFrom(
  input: HttpRequestInput,
  headerName = "x-request-id"
): Record<string, unknown> {
  const fromHeader = headerGet(input.headers, headerName);
  const requestId = allocateRequestId(input.requestId ?? fromHeader);
  const fields: Record<string, unknown> = { requestId };
  if (input.method) {
    fields.method = input.method;
  }
  const path = input.path ?? (input.url ? requestPathFromUrl(input.url) : undefined);
  if (path) {
    fields.path = path;
  }
  return fields;
}

export function pickAllowlistedHeaders(
  headers: HeaderBag | Record<string, string | string[] | undefined> | undefined,
  names: readonly string[] | undefined
): Record<string, unknown> {
  if (!headers || !names || names.length === 0) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const name of names) {
    const value = headerGet(headers, name);
    if (value !== null && value.length > 0) {
      out[name] = sanitizeString(value);
    }
  }
  return out;
}

/**
 * One structured access line. Level is error when status >= 500 or error is set.
 */
export function logRequestCompletion(logger: Logger, fields: RequestCompletionFields): void {
  const payload: Record<string, unknown> = {
    event: "http_request",
    status: fields.status,
    elapsedMs: fields.elapsedMs,
  };
  if (fields.method) {
    payload.method = fields.method;
  }
  if (fields.path) {
    payload.path = fields.path;
  }
  if (fields.error instanceof Error) {
    Object.assign(payload, sanitizeError(fields.error));
  } else if (fields.error !== undefined) {
    payload.error = {
      message: sanitizeString(String(fields.error)),
    };
  }
  const level = fields.status >= 500 || fields.error !== undefined ? "error" : "info";
  if (level === "error") {
    logger.error(payload);
  } else {
    logger.info(payload);
  }
}

export function withHttpContext<T>(
  input: HttpRequestInput,
  fn: () => T | Promise<T>,
  options: WithHttpContextOptions = {}
): T | Promise<T> {
  const headerName = options.headerName ?? "x-request-id";
  const fields = {
    ...pickAllowlistedHeaders(input.headers, options.headersAllowlist),
    ...(options.extra ?? {}),
    ...httpFieldsFrom(input, headerName),
  };
  return withContext(fields, fn);
}
