export type ConsoleMethodName = "log" | "info" | "warn" | "error" | "debug";

export type ConsoleMethods = {
  [K in ConsoleMethodName]: (...args: unknown[]) => void;
};

let bridgeOriginals: ConsoleMethods | null = null;
let bridgeDepth = 0;

export function setBridgeOriginals(methods: ConsoleMethods | null): void {
  bridgeOriginals = methods;
}

export function getBridgeOriginals(): ConsoleMethods | null {
  return bridgeOriginals;
}

export function enterBridge(): void {
  bridgeDepth += 1;
}

export function leaveBridge(): void {
  if (bridgeDepth > 0) {
    bridgeDepth -= 1;
  }
}

export function isInBridge(): boolean {
  return bridgeDepth > 0;
}

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
