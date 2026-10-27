/** Format a Date as an ISO-8601 UTC string ending in `Z`. */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/** Subset of the Performance API used for microsecond timestamps. */
export type PerformanceLike = {
  now: () => number;
  timeOrigin: number;
};

function isPerformanceLike(value: unknown): value is PerformanceLike {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, "now") === "function" &&
    typeof Reflect.get(value, "timeOrigin") === "number"
  );
}

/**
 * Prefer microsecond precision via performance.timeOrigin when no test clock is set.
 * Pass perf=null to force the Date millisecond fallback.
 */
export function currentTimestamp(clock?: () => Date, perf?: PerformanceLike | null): string {
  if (clock) {
    return formatTimestamp(clock());
  }
  const resolved = perf === undefined ? defaultPerformance() : (perf ?? undefined);
  try {
    if (resolved) {
      const epochMs = resolved.timeOrigin + resolved.now();
      const wholeSeconds = Math.floor(epochMs / 1000);
      const micros = Math.round((epochMs % 1000) * 1000);
      const isoSecond = new Date(wholeSeconds * 1000).toISOString().replace(/\.\d{3}Z$/, "");
      return `${isoSecond}.${String(micros).padStart(6, "0")}Z`;
    }
  } catch {
    // fall through to Date
  }
  return formatTimestamp(new Date());
}

/** Resolve `globalThis.performance` when it looks like {@link PerformanceLike}. */
export function defaultPerformance(globalPerf?: unknown | null): PerformanceLike | undefined {
  const resolved =
    globalPerf === undefined
      ? typeof performance !== "undefined"
        ? performance
        : undefined
      : globalPerf;
  if (isPerformanceLike(resolved)) {
    return resolved;
  }
  return undefined;
}
