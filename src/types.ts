/** Minimum severity that will be emitted. */
export type Level = "debug" | "info" | "warn" | "error" | "fatal";

/** Uppercase severity string written on each log line. */
export type SeverityName = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

/** Value accepted by severity methods: plain text, structured fields, or an Error. */
export type LogMessage = string | Record<string, unknown> | Error;

/** Sanitized object passed to sinks and JSON serialization. */
export type LogRecord = Record<string, unknown>;

/** Destination for one JSON line plus its record. */
export type Sink = {
  write(line: string, record: LogRecord): void | Promise<void>;
};

/** Root-field transform applied after message parse and before path redact. */
export type FieldSerializer = (value: unknown) => unknown;

/** Optional ambient enrichment at log time (e.g. trace ids). Must not throw; throws take never-raise fallback. */
export type ContextProvider = () => Record<string, unknown> | undefined;

/**
 * How matched redact leaves are replaced.
 * `filtered` writes `[FILTERED]`; `remove` drops object keys (array slots become `null`);
 * `hash` writes a non-cryptographic `[label:hex8]` correlation token.
 */
export type RedactCensor = "filtered" | "remove" | "hash" | ((value: unknown) => unknown);

/** Path and key redaction options (RFC-0005). Array form remains path-only with `filtered`. */
export type RedactOptions = {
  /** Dot paths; segment `*` matches one key or index. */
  paths?: readonly string[];
  /** Object key names matched anywhere in the record tree. */
  keys?: readonly string[];
  /** When true, `keys` matching ignores case. Default false. */
  caseInsensitive?: boolean;
  /** Replacement mode. Default `filtered`. */
  censor?: RedactCensor;
  /** Label inside hash tokens. Default `hash`. */
  hashLabel?: string;
};

/** Construction options for {@link Logger}. */
export type LoggerOptions = {
  /** Minimum level to emit. Default `info`. */
  level?: Level;
  /** Output destination. Default console sink. */
  sink?: Sink;
  /** Fields merged into every line at the root. */
  base?: Record<string, unknown>;
  /** Clock for timestamps (tests). */
  clock?: () => Date;
  /** Sticky tags applied to every line from this logger. */
  tags?: readonly string[];
  /**
   * Dot paths (RFC-0002) or {@link RedactOptions} with keys and censor modes (RFC-0005).
   * Config-time only. Segment `*` matches one key or index.
   */
  redact?: readonly string[] | RedactOptions;
  /** Root field name to serializer. */
  serializers?: Readonly<Record<string, FieldSerializer>>;
  /** Merged under `context` after ALS ambient context; call-site context wins. */
  contextProvider?: ContextProvider;
};

/** JSON scalar used in sanitized payloads. */
export type JsonPrimitive = string | number | boolean | null;

/** JSON-compatible value after sanitization. */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
