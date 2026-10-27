import { plainObjectFrom } from "./objects.js";

const FILTERED = "[FILTERED]";

/** Dot-path segments after {@link compileRedactPaths} (config-time). */
export type CompiledRedactPath = readonly string[];

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

function redactArray(
  value: unknown[],
  parts: CompiledRedactPath,
  index: number,
  key: string
): unknown {
  if (key === "*") {
    return value.map((item) => redactAt(item, parts, index + 1));
  }
  const idx = Number(key);
  if (!Number.isInteger(idx) || idx < 0 || idx >= value.length) {
    return value;
  }
  const copy = value.slice();
  copy[idx] = redactAt(copy[idx], parts, index + 1);
  return copy;
}

function redactObject(
  value: { [key: string]: unknown },
  parts: CompiledRedactPath,
  index: number,
  key: string
): unknown {
  if (key === "*") {
    const out: { [key: string]: unknown } = {};
    for (const childKey of Object.keys(value)) {
      out[childKey] = redactAt(value[childKey], parts, index + 1);
    }
    return out;
  }
  if (!(key in value)) {
    return value;
  }
  return {
    ...value,
    [key]: redactAt(value[key], parts, index + 1),
  };
}

function redactAt(value: unknown, parts: CompiledRedactPath, index: number): unknown {
  if (index >= parts.length) {
    return FILTERED;
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const key = String(parts[index]);
  if (Array.isArray(value)) {
    return redactArray(value, parts, index, key);
  }
  return redactObject(plainObjectFrom(value), parts, index, key);
}

/** Apply precompiled redact paths to a value tree. */
export function applyCompiledRedactPaths(
  value: unknown,
  paths: readonly CompiledRedactPath[]
): unknown {
  let current = value;
  for (const parts of paths) {
    current = redactAt(current, parts, 0);
  }
  return current;
}

/** Apply string paths (compiles each call). Prefer compileRedactPaths on hot paths. */
export function applyRedactPaths(value: unknown, paths: readonly string[]): unknown {
  return applyCompiledRedactPaths(value, compileRedactPaths(paths));
}
