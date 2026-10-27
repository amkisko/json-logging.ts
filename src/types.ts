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
  /** Dot paths to filter (config-time only). Segment `*` matches one key or index. */
  redact?: readonly string[];
  /** Root field name to serializer. */
  serializers?: Readonly<Record<string, FieldSerializer>>;
  /** Merged under `context` after ALS ambient context; call-site context wins. */
  contextProvider?: ContextProvider;
};

/** JSON scalar used in sanitized payloads. */
export type JsonPrimitive = string | number | boolean | null;

/** JSON-compatible value after sanitization. */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
