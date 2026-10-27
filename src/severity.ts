import type { Level, SeverityName } from "./types.js";

/** Numeric order used to compare levels (higher is more severe). */
export const LEVEL_ORDER: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/** Map from {@link Level} to the severity string written on each line. */
export const SEVERITY_NAMES: Record<Level, SeverityName> = {
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  fatal: "FATAL",
};

/** Return the uppercase severity name for a level. */
export function severityName(level: Level): SeverityName {
  return SEVERITY_NAMES[level];
}

/** True when `requested` is at or above the configured minimum level. */
export function isEnabled(configured: Level, requested: Level): boolean {
  return LEVEL_ORDER[requested] >= LEVEL_ORDER[configured];
}
