import {
  type ConsoleMethodName,
  type ConsoleMethods,
  captureConsoleMethods,
  enterBridge,
  getBridgeOriginals,
  isInBridge,
  leaveBridge,
  setBridgeOriginals,
} from "./console-state.js";
import { createLogger } from "./json-logging.js";
import type { Logger } from "./logger.js";
import { isPlainObject } from "./objects.js";
import { consoleSinkFrom } from "./sinks.js";
import type { Level, LoggerOptions, LogMessage } from "./types.js";

export type ConsoleBridgeOptions = {
  methods?: readonly ConsoleMethodName[];
};

export type StructuredLoggingInstall = {
  logger: Logger;
  uninstall: () => void;
};

const DEFAULT_METHODS: readonly ConsoleMethodName[] = ["log", "info", "warn", "error", "debug"];

const LEVEL_BY_METHOD: Record<ConsoleMethodName, Level> = {
  log: "info",
  info: "info",
  warn: "warn",
  error: "error",
  debug: "debug",
};

let installedMethods: ConsoleMethodName[] | null = null;

export function isConsoleBridgeInstalled(): boolean {
  return getBridgeOriginals() !== null;
}

export function uninstallConsoleBridge(): void {
  const originals = getBridgeOriginals();
  if (!originals || !installedMethods) {
    setBridgeOriginals(null);
    installedMethods = null;
    return;
  }
  for (const name of installedMethods) {
    Reflect.set(console, name, originals[name]);
  }
  setBridgeOriginals(null);
  installedMethods = null;
}

/**
 * Routes console.log/info/warn/error/debug through `logger` as structured JSON.
 * Opt-in only. Does not capture framework internals or libraries that bypass console.
 * Safe with the default console sink: writes use the pre-patch console methods.
 */
export function installConsoleBridge(
  logger: Logger,
  options: ConsoleBridgeOptions = {}
): () => void {
  uninstallConsoleBridge();
  const originals = captureConsoleMethods(console);
  setBridgeOriginals(originals);
  const methods = options.methods ?? DEFAULT_METHODS;
  installedMethods = [...methods];

  for (const name of methods) {
    const level = LEVEL_BY_METHOD[name];
    Reflect.set(console, name, (...args: unknown[]) => {
      if (isInBridge()) {
        originals[name](...args);
        return;
      }
      enterBridge();
      try {
        writeThroughLogger(logger, level, args);
      } finally {
        leaveBridge();
      }
    });
  }

  return uninstallConsoleBridge;
}

/**
 * One-call setup: logger that writes via captured console methods, plus console bridge.
 * Prefer this when the goal is "app + console.* become structured JSON lines".
 */
export function installStructuredLogging(
  options: LoggerOptions & ConsoleBridgeOptions = {}
): StructuredLoggingInstall {
  const { methods, ...loggerOptions } = options;
  // Restore real console methods before capture so a re-install does not
  // bind the sink to an already patched console.
  uninstallConsoleBridge();
  const originals = captureConsoleMethods(console);
  const logger = createLogger({
    ...loggerOptions,
    sink: loggerOptions.sink ?? consoleSinkFrom(originals),
  });
  const uninstall = installConsoleBridge(logger, methods ? { methods } : {});
  return { logger, uninstall };
}

export function messageFromConsoleArgs(args: unknown[]): LogMessage {
  if (args.length === 0) {
    return "";
  }
  if (args.length === 1) {
    return singleArgMessage(args[0]);
  }
  return {
    message: args.map(stringifyArg).join(" "),
    console_args: args.map(snapshotArg),
  };
}

function writeThroughLogger(logger: Logger, level: Level, args: unknown[]): void {
  const message = messageFromConsoleArgs(args);
  switch (level) {
    case "debug":
      logger.debug(message);
      break;
    case "warn":
      logger.warn(message);
      break;
    case "error":
    case "fatal":
      logger.error(message);
      break;
    default:
      logger.info(message);
  }
}

function singleArgMessage(value: unknown): LogMessage {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value;
  }
  if (isPlainObject(value)) {
    return value;
  }
  return stringifyArg(value);
}

function stringifyArg(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return "[unstringifiable]";
  }
}

function snapshotArg(value: unknown): unknown {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (isPlainObject(value)) {
    return value;
  }
  return stringifyArg(value);
}

export type { ConsoleMethods, ConsoleMethodName };
