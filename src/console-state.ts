/** Console method names the bridge may patch. */
export type ConsoleMethodName = "log" | "info" | "warn" | "error" | "debug";

/** Bound console method bag used by sinks and the bridge. */
export type ConsoleMethods = {
  [K in ConsoleMethodName]: (...args: unknown[]) => void;
};

let bridgeOriginals: ConsoleMethods | null = null;
let bridgeDepth = 0;

/** Store or clear the pre-patch console methods while the bridge is installed. */
export function setBridgeOriginals(methods: ConsoleMethods | null): void {
  bridgeOriginals = methods;
}

/** Pre-patch console methods, or null when the bridge is not installed. */
export function getBridgeOriginals(): ConsoleMethods | null {
  return bridgeOriginals;
}

/** Enter a re-entrancy guard so bridge writes use original console methods. */
export function enterBridge(): void {
  bridgeDepth += 1;
}

/** Leave the re-entrancy guard opened by {@link enterBridge}. */
export function leaveBridge(): void {
  if (bridgeDepth > 0) {
    bridgeDepth -= 1;
  }
}

/** True while a bridged console write is in progress. */
export function isInBridge(): boolean {
  return bridgeDepth > 0;
}

/** Snapshot console methods from `target` (defaults to global `console`). */
export function captureConsoleMethods(
  target: Partial<ConsoleMethods> & object = console
): ConsoleMethods {
  return {
    log: bindMethod(target, "log"),
    info: bindMethod(target, "info"),
    warn: bindMethod(target, "warn"),
    error: bindMethod(target, "error"),
    debug: bindMethod(target, "debug"),
  };
}

function bindMethod(
  target: Partial<ConsoleMethods> & object,
  name: ConsoleMethodName
): (...args: unknown[]) => void {
  const method = Reflect.get(target, name);
  if (typeof method === "function") {
    return (...args: unknown[]) => {
      Reflect.apply(method, target, args);
    };
  }
  return (...args: unknown[]) => {
    Reflect.apply(console.log, console, args);
  };
}
