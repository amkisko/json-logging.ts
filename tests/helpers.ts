import type { LogRecord, Sink } from "../src/types.js";

export type Captured = { line: string; record: LogRecord };

export function capturingSink(): Sink & { entries: Captured[] } {
  const entries: Captured[] = [];
  return {
    entries,
    write(line: string, record: LogRecord): void {
      entries.push({ line, record });
    },
  };
}

export function parseLine(line: string): Record<string, unknown> {
  const trimmed = line.endsWith("\n") ? line.slice(0, -1) : line;
  return JSON.parse(trimmed) as Record<string, unknown>;
}

export const fixedClock = (): Date => new Date("2026-10-26T05:30:00.000Z");
