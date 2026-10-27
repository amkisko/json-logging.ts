import { afterEach, describe, expect, test } from "bun:test";
import {
  installConsoleBridge,
  installStructuredLogging,
  isConsoleBridgeInstalled,
  messageFromConsoleArgs,
  uninstallConsoleBridge,
} from "../src/console.js";
import { captureConsoleMethods, createLogger } from "../src/index.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

afterEach(() => {
  uninstallConsoleBridge();
});

describe("messageFromConsoleArgs", () => {
  test("handles empty single string object error and primitives", () => {
    expect(messageFromConsoleArgs([])).toBe("");
    expect(messageFromConsoleArgs(["hi"])).toBe("hi");
    expect(messageFromConsoleArgs([{ event: "x" }])).toEqual({ event: "x" });
    const err = new Error("boom");
    expect(messageFromConsoleArgs([err])).toBe(err);
    expect(messageFromConsoleArgs([null])).toBe("null");
    expect(messageFromConsoleArgs([undefined])).toBe("undefined");
    expect(messageFromConsoleArgs([1])).toBe("1");
    expect(messageFromConsoleArgs([true])).toBe("true");
  });

  test("joins multiple args and snapshots values", () => {
    const msg = messageFromConsoleArgs(["a", 1, { k: "v" }, new Error("e"), null]) as Record<
      string,
      unknown
    >;
    expect(msg.message).toBe('a 1 {"k":"v"} e null');
    expect(Array.isArray(msg.console_args)).toBe(true);
  });

  test("keeps single plain object even when circular", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(messageFromConsoleArgs([circular])).toBe(circular);
  });

  test("stringifies circular values in multi-arg messages", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    const msg = messageFromConsoleArgs(["prefix", circular]) as Record<string, unknown>;
    expect(String(msg.message)).toContain("prefix");
    expect(String(msg.message)).toContain("[unstringifiable]");
  });

  test("snapshots arrays and functions in multi-arg messages", () => {
    const msg = messageFromConsoleArgs(["x", [1, 2], () => 1]) as Record<string, unknown>;
    expect(msg.message).toBeTruthy();
    expect(Array.isArray(msg.console_args)).toBe(true);
  });
});

describe("installConsoleBridge", () => {
  test("routes console methods through logger as JSON", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock, level: "debug" });
    installConsoleBridge(logger);
    expect(isConsoleBridgeInstalled()).toBe(true);

    console.log("from-log");
    console.info("from-info");
    console.warn("from-warn");
    console.error("from-error");
    console.debug("from-debug");

    expect(sink.entries).toHaveLength(5);
    expect(parseLine(sink.entries[0]!.line).message).toBe("from-log");
    expect(parseLine(sink.entries[0]!.line).severity).toBe("INFO");
    expect(parseLine(sink.entries[2]!.line).severity).toBe("WARN");
    expect(parseLine(sink.entries[3]!.line).severity).toBe("ERROR");
    expect(parseLine(sink.entries[4]!.line).severity).toBe("DEBUG");
  });

  test("does not double-log when logger uses default console sink", () => {
    const written: string[] = [];
    const originalInfo = console.info.bind(console);
    console.info = ((msg: string) => {
      written.push(String(msg));
    }) as typeof console.info;

    try {
      const logger = createLogger({ clock: fixedClock });
      installConsoleBridge(logger);
      logger.info("direct");
      console.log("bridged");
      expect(written).toHaveLength(2);
      expect(parseLine(`${written[0]}\n`).message).toBe("direct");
      expect(parseLine(`${written[1]}\n`).message).toBe("bridged");
    } finally {
      uninstallConsoleBridge();
      console.info = originalInfo;
    }
  });

  test("uninstall restores console and is idempotent", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const uninstall = installConsoleBridge(logger);
    uninstall();
    expect(isConsoleBridgeInstalled()).toBe(false);
    const before = sink.entries.length;
    console.info("not-bridged");
    expect(sink.entries.length).toBe(before);
    uninstallConsoleBridge();
    uninstallConsoleBridge();
  });

  test("replacing install restores previous patch cleanly", () => {
    const first = capturingSink();
    const second = capturingSink();
    installConsoleBridge(createLogger({ sink: first, clock: fixedClock }));
    installConsoleBridge(createLogger({ sink: second, clock: fixedClock }));
    console.info("second-only");
    expect(first.entries).toHaveLength(0);
    expect(second.entries).toHaveLength(1);
  });

  test("subset of methods can be bridged", () => {
    const sink = capturingSink();
    installConsoleBridge(createLogger({ sink, clock: fixedClock }), {
      methods: ["error"],
    });
    console.info("skip");
    console.error("take");
    expect(sink.entries).toHaveLength(1);
    expect(parseLine(sink.entries[0]!.line).message).toBe("take");
  });

  test("reentrancy falls back to originals", () => {
    const nested: string[] = [];
    console.info = ((...args: unknown[]) => {
      nested.push(args.map(String).join(" "));
    }) as typeof console.info;
    const reenterSink = {
      write(): void {
        console.info("from-custom-sink");
      },
    };
    installConsoleBridge(createLogger({ sink: reenterSink, clock: fixedClock }));
    console.info("outer");
    expect(nested).toContain("from-custom-sink");
  });
});

describe("captureConsoleMethods", () => {
  test("falls back to console.log when a method is missing", () => {
    const methods = captureConsoleMethods({});
    expect(typeof methods.debug).toBe("function");
    methods.debug("fallback-ok");
  });
});

describe("installStructuredLogging", () => {
  test("wires logger and console together", () => {
    const written: string[] = [];
    const previous = console.info.bind(console);
    console.info = ((msg: string) => {
      written.push(String(msg));
    }) as typeof console.info;

    try {
      const { logger, uninstall } = installStructuredLogging({
        clock: fixedClock,
        base: { service: "demo" },
      });
      logger.info("via-logger");
      console.log("via-console");
      expect(written.length).toBe(2);
      expect(parseLine(`${written[0]}\n`).service).toBe("demo");
      expect(parseLine(`${written[1]}\n`).message).toBe("via-console");
      uninstall();
      expect(isConsoleBridgeInstalled()).toBe(false);
    } finally {
      uninstallConsoleBridge();
      console.info = previous;
    }
  });
});
