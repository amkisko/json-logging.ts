/**
 * Opt-in console bridge: route `console.log` / `info` / `warn` / `error` / `debug`
 * through a structured {@link Logger}.
 *
 * @example
 * ```ts
 * import { installStructuredLogging } from "@amkisko/json-logging/console";
 *
 * const { logger, uninstall } = installStructuredLogging({ base: { service: "api" } });
 * console.log("also structured");
 * uninstall();
 * ```
 *
 * @module
 */

export type {
  ConsoleBridgeOptions,
  StructuredLoggingInstall,
} from "./console-bridge.js";
export {
  installConsoleBridge,
  installStructuredLogging,
  isConsoleBridgeInstalled,
  messageFromConsoleArgs,
  uninstallConsoleBridge,
} from "./console-bridge.js";
