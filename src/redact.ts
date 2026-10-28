import { plainObjectFrom } from "./objects.js";
import type { RedactCensor, RedactOptions } from "./types.js";

const FILTERED = "[FILTERED]";
const REMOVED = Symbol("json-logging-removed");

/** Dot-path segments after {@link compileRedactPaths} (config-time). */
export type CompiledRedactPath = readonly string[];

/** Resolved redact plan used on the log hot path. */
export type CompiledRedact = {
  paths: readonly CompiledRedactPath[];
  keys: ReadonlySet<string>;
  caseInsensitive: boolean;
  replace: (value: unknown) => unknown;
};

function splitPath(path: string): string[] | undefined {
  if (path.length === 0) {
    return undefined;
  }
  const parts = path.split(".");
  if (parts.some((part) => part.length === 0)) {
    return undefined;
  }
  return parts;
}

/** Compile redact paths once at logger construction. Config-time only. */
export function compileRedactPaths(paths: readonly string[]): CompiledRedactPath[] {
  const compiled: CompiledRedactPath[] = [];
  for (const path of paths) {
    const parts = splitPath(path);
    if (parts) {
      compiled.push(parts);
    }
  }
  return compiled;
}

function fnv1a32Hex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function valueFingerprint(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function resolveReplace(
  censor: RedactCensor | undefined,
  hashLabel: string
): (value: unknown) => unknown {
  if (censor === "remove") {
    return () => REMOVED;
  }
  if (censor === "hash") {
    const label = hashLabel.length > 0 ? hashLabel : "hash";
    return (value) => `[${label}:${fnv1a32Hex(valueFingerprint(value))}]`;
  }
  if (typeof censor === "function") {
    return censor;
  }
  return () => FILTERED;
}

function isRedactOptions(value: readonly string[] | RedactOptions): value is RedactOptions {
  return !Array.isArray(value);
}

function normalizeOptions(input: readonly string[] | RedactOptions | undefined): RedactOptions {
  if (input === undefined) {
    return {};
  }
  if (isRedactOptions(input)) {
    return input;
  }
  return { paths: input };
}

/** Compile path and key redact options once at logger construction. */
export function compileRedact(
  input: readonly string[] | RedactOptions | undefined
): CompiledRedact {
  const options = normalizeOptions(input);
  const caseInsensitive = options.caseInsensitive === true;
  const keys = new Set<string>();
  for (const key of options.keys ?? []) {
    if (key.length === 0) {
      continue;
    }
    keys.add(caseInsensitive ? key.toLowerCase() : key);
  }
  return {
    paths: compileRedactPaths(options.paths ?? []),
    keys,
    caseInsensitive,
    replace: resolveReplace(options.censor, options.hashLabel ?? "hash"),
  };
}

function keyMatches(name: string, compiled: CompiledRedact): boolean {
  return compiled.keys.has(compiled.caseInsensitive ? name.toLowerCase() : name);
}

function redactArray(
  value: unknown[],
  parts: CompiledRedactPath,
  index: number,
  key: string,
  compiled: CompiledRedact
): unknown {
  if (key === "*") {
    return value.map((item) => redactAt(item, parts, index + 1, compiled));
  }
  const idx = Number(key);
  if (!Number.isInteger(idx) || idx < 0 || idx >= value.length) {
    return value;
  }
  const copy = value.slice();
  const next = redactAt(copy[idx], parts, index + 1, compiled);
  copy[idx] = next === REMOVED ? null : next;
  return copy;
}

function redactObject(
  value: { [key: string]: unknown },
  parts: CompiledRedactPath,
  index: number,
  key: string,
  compiled: CompiledRedact
): unknown {
  if (key === "*") {
    const out: { [key: string]: unknown } = {};
    for (const childKey of Object.keys(value)) {
      const next = redactAt(value[childKey], parts, index + 1, compiled);
      if (next !== REMOVED) {
        out[childKey] = next;
      }
    }
    return out;
  }
  if (!(key in value)) {
    return value;
  }
  const next = redactAt(value[key], parts, index + 1, compiled);
  if (next === REMOVED) {
    const out = { ...value };
    delete out[key];
    return out;
  }
  return { ...value, [key]: next };
}

function redactAt(
  value: unknown,
  parts: CompiledRedactPath,
  index: number,
  compiled: CompiledRedact
): unknown {
  if (index >= parts.length) {
    return compiled.replace(value);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const key = String(parts[index]);
  if (Array.isArray(value)) {
    return redactArray(value, parts, index, key, compiled);
  }
  return redactObject(plainObjectFrom(value), parts, index, key, compiled);
}

function applyKeys(value: unknown, compiled: CompiledRedact): unknown {
  if (compiled.keys.size === 0) {
    return value;
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    return items.map((item: unknown) => applyKeys(item, compiled));
  }
  const source = plainObjectFrom(value);
  const out: { [key: string]: unknown } = {};
  for (const key of Object.keys(source)) {
    if (keyMatches(key, compiled)) {
      const replaced = compiled.replace(source[key]);
      if (replaced !== REMOVED) {
        out[key] = replaced;
      }
      continue;
    }
    out[key] = applyKeys(source[key], compiled);
  }
  return out;
}

/** Apply a compiled redact plan (paths then keys). */
export function applyCompiledRedact(value: unknown, compiled: CompiledRedact): unknown {
  let current = value;
  for (const parts of compiled.paths) {
    current = redactAt(current, parts, 0, compiled);
  }
  return applyKeys(current, compiled);
}

/** Apply precompiled path list with default `[FILTERED]` censor. */
export function applyCompiledRedactPaths(
  value: unknown,
  paths: readonly CompiledRedactPath[]
): unknown {
  return applyCompiledRedact(value, {
    paths,
    keys: new Set(),
    caseInsensitive: false,
    replace: () => FILTERED,
  });
}

/** Apply string paths (compiles each call). Prefer compileRedact on hot paths. */
export function applyRedactPaths(value: unknown, paths: readonly string[]): unknown {
  return applyCompiledRedact(value, compileRedact(paths));
}

/** True when the compiled plan has any paths or keys. */
export function hasRedactWork(compiled: CompiledRedact): boolean {
  return compiled.paths.length > 0 || compiled.keys.size > 0;
}
