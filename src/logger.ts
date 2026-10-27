import { withBlockTags } from "./context.js";
import { type CompiledRedactPath, compileRedactPaths } from "./redact.js";
import { prepareTags, sanitizeHash } from "./sanitize.js";
import { buildFallbackRecord, buildRecord, toJsonLine } from "./serialize.js";
import { isEnabled } from "./severity.js";
import { consoleSink } from "./sinks.js";
import type {
  ContextProvider,
  FieldSerializer,
  Level,
  LoggerOptions,
  LogMessage,
  Sink,
} from "./types.js";

function isCallback(value: unknown): value is () => unknown {
  return typeof value === "function";
}

/** Structured logger: severity methods, sticky tags, child loggers, never-raise emit path. */
export class Logger {
  /** Minimum level that will be written. */
  readonly level: Level;
  /** Destination for JSON lines. */
  readonly sink: Sink;
  /** Sanitized root fields merged into every line. */
  readonly base: Record<string, unknown>;
  /** Optional clock override (tests). */
  readonly clock?: () => Date;
  /** Sticky tags from construction or {@link Logger.tagged}. */
  readonly tags: readonly string[];
  /** Configured redact paths (dot notation). */
  readonly redact: readonly string[];
  /** Root-field serializers. */
  readonly serializers: Readonly<Record<string, FieldSerializer>>;
  /** Optional ambient context provider. */
  readonly contextProvider?: ContextProvider;
  private readonly compiledRedact: readonly CompiledRedactPath[];

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? "info";
    this.sink = options.sink ?? consoleSink();
    this.base = options.base ? sanitizeHash(options.base) : {};
    this.clock = options.clock;
    this.tags = options.tags ? prepareTags(options.tags) : [];
    this.redact = options.redact ? [...options.redact] : [];
    this.serializers = options.serializers ? { ...options.serializers } : {};
    this.contextProvider = options.contextProvider;
    this.compiledRedact = compileRedactPaths(this.redact);
  }

  /** True when a message at `level` would be emitted. */
  isLevelEnabled(level: Level): boolean {
    return isEnabled(this.level, level);
  }

  /** Emit a debug line when enabled. */
  debug(message: LogMessage): void {
    this.log("debug", message);
  }

  /** Emit an info line when enabled. */
  info(message: LogMessage): void {
    this.log("info", message);
  }

  /** Emit a warn line when enabled. */
  warn(message: LogMessage): void {
    this.log("warn", message);
  }

  /** Emit an error line when enabled. */
  error(message: LogMessage): void {
    this.log("error", message);
  }

  /** Emit a fatal line when enabled. */
  fatal(message: LogMessage): void {
    this.log("fatal", message);
  }

  /** Child logger with extra root bindings merged into `base`. */
  child(bindings: Record<string, unknown>): Logger {
    return new Logger({
      level: this.level,
      sink: this.sink,
      clock: this.clock,
      tags: this.tags,
      redact: this.redact,
      serializers: this.serializers,
      contextProvider: this.contextProvider,
      base: { ...this.base, ...sanitizeHash(bindings) },
    });
  }

  /**
   * Block form runs `fn` with nested tags; sticky form returns a child logger.
   * Pass tags then a callback, or only tags for a sticky child.
   */
  tagged(callback: () => unknown): unknown;
  tagged(tag: string | number | boolean, callback: () => unknown): unknown;
  tagged(
    tag: string | number | boolean,
    tag2: string | number | boolean,
    callback: () => unknown
  ): unknown;
  tagged(...tags: (string | number | boolean | null | undefined)[]): Logger;
  tagged(...args: unknown[]): Logger | unknown {
    if (args.length === 0) {
      return this;
    }
    const last = args[args.length - 1];
    if (isCallback(last)) {
      const tags = prepareTags(args.slice(0, -1));
      return withBlockTags(tags, last);
    }
    const tags = prepareTags(args);
    return new Logger({
      level: this.level,
      sink: this.sink,
      clock: this.clock,
      base: this.base,
      redact: this.redact,
      serializers: this.serializers,
      contextProvider: this.contextProvider,
      tags: [...this.tags, ...tags],
    });
  }

  private log(level: Level, message: LogMessage): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }
    try {
      const record = buildRecord({
        message,
        level,
        stickyTags: this.tags,
        base: this.base,
        preparedBase: true,
        preparedTags: true,
        clock: this.clock,
        compiledRedact: this.compiledRedact,
        serializers: this.serializers,
        contextProvider: this.contextProvider,
      });
      const line = toJsonLine(record);
      void this.sink.write(line, record);
    } catch (error) {
      try {
        const fallback = buildFallbackRecord(level, message, error, this.clock);
        const line = toJsonLine(fallback);
        void this.sink.write(line, fallback);
      } catch {
        // Last resort: never throw from the log path.
      }
    }
  }
}
