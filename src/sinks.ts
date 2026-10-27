import { type ConsoleMethods, captureConsoleMethods, getBridgeOriginals } from "./console-state.js";
import type { LogRecord, SeverityName, Sink } from "./types.js";

function pickMethod(methods: ConsoleMethods, severity: unknown): (...args: unknown[]) => void {
  const name = typeof severity === "string" ? severity.toUpperCase() : "INFO";
  switch (name as SeverityName | string) {
    case "ERROR":
    case "FATAL":
      return methods.error;
    case "WARN":
      return methods.warn;
    case "DEBUG":
      return methods.debug;
    default:
      return methods.info;
  }
}

/** Writes JSON lines using the given console method table (usually pre-bridge originals). */
export function consoleSinkFrom(methods: ConsoleMethods): Sink {
  return {
    write(line: string, record: LogRecord): void {
      const method = pickMethod(methods, record.severity);
      const trimmed = line.endsWith("\n") ? line.slice(0, -1) : line;
      method(trimmed);
    },
  };
}

/**
 * Default console sink. When a console bridge is installed, writes through the
 * captured originals so logger calls do not re-enter the bridge.
 */
export function consoleSink(): Sink {
  return {
    write(line: string, record: LogRecord): void {
      const methods = getBridgeOriginals() ?? captureConsoleMethods(console);
      const method = pickMethod(methods, record.severity);
      const trimmed = line.endsWith("\n") ? line.slice(0, -1) : line;
      method(trimmed);
    },
  };
}

/** Sink that writes JSON lines to a Web Streams `WritableStream`. */
export function streamSink(
  stream: WritableStream<Uint8Array>,
  options?: { encoding?: "utf-8" }
): Sink {
  const encoding = options?.encoding ?? "utf-8";
  const encoder = new TextEncoder();
  let chain: Promise<void> = Promise.resolve();

  return {
    write(line: string, _record: LogRecord): Promise<void> {
      const chunk = line.endsWith("\n") ? line : `${line}\n`;
      const bytes = encoding === "utf-8" ? encoder.encode(chunk) : encoder.encode(chunk);
      chain = chain
        .then(async () => {
          const writer = stream.getWriter();
          try {
            await writer.write(bytes);
          } finally {
            writer.releaseLock();
          }
        })
        .catch(() => {
          // Never throw from the sink chain; swallow write failures.
        });
      return chain;
    },
  };
}
