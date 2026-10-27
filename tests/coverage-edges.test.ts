import { beforeEach, describe, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type AlsConstructor,
  getBlockTags,
  getContext,
  isAsyncLocalStorageAvailable,
  readStore,
  resetContextStorageForTests,
  setAlsConstructorForTests,
  setAlsOverrideForTests,
  withBlockTags,
  withContext,
} from "../src/context.js";
import { httpLogger, resetHttpLoggerForTests } from "../src/http.js";
import { createLogger } from "../src/json-logging.js";
import { allocateRequestId, defaultRandomId, fallbackRequestId } from "../src/next.js";
import { MAX_DEPTH, sanitizeError, sanitizeHash, sanitizeValue } from "../src/sanitize.js";
import { currentTimestamp, defaultPerformance } from "../src/serialize.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

beforeEach(() => {
  setAlsConstructorForTests(undefined);
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("context edge coverage", () => {
  test("uses explicit ALS override instance", () => {
    const als = new AsyncLocalStorage<{
      context: Record<string, unknown>;
      tags: string[];
    }>();
    setAlsOverrideForTests(als);
    als.run({ context: { via: "override" }, tags: ["t"] }, () => {
      expect(getContext()).toEqual({ via: "override" });
      expect(getBlockTags()).toEqual(["t"]);
    });
  });

  test("readStore returns undefined when getStore throws", () => {
    const als = {
      getStore() {
        throw new Error("getStore failed");
      },
    } as unknown as AsyncLocalStorage<{
      context: Record<string, unknown>;
      tags: string[];
    }>;
    expect(readStore(als)).toBeUndefined();
    expect(readStore(undefined)).toBeUndefined();
  });

  test("withBlockTags runs without ALS", () => {
    setAlsOverrideForTests(null);
    let ran = false;
    withBlockTags(["x"], () => {
      ran = true;
      expect(getBlockTags()).toEqual([]);
    });
    expect(ran).toBe(true);
  });

  test("getBlockTags empty when store has no tags", () => {
    withContext({ a: 1 }, () => {
      expect(getBlockTags()).toEqual([]);
    });
  });

  test("basic logging works when ALS constructor is unavailable", () => {
    setAlsConstructorForTests(null);
    expect(isAsyncLocalStorageAvailable()).toBe(false);
    resetContextStorageForTests();
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    logger.info("no-als");
    expect(parseLine(sink.entries[0]!.line).message).toBe("no-als");
    let ran = false;
    withContext({ requestId: "x" }, () => {
      ran = true;
      expect(getContext()).toBeUndefined();
      logger.tagged("a", () => {
        expect(getBlockTags()).toEqual([]);
      });
    });
    expect(ran).toBe(true);
  });

  test("uses injected ALS constructor and creates singleton when missing", () => {
    setAlsConstructorForTests(null);
    resetContextStorageForTests();
    setAlsConstructorForTests(AsyncLocalStorage as unknown as AlsConstructor);
    expect(isAsyncLocalStorageAvailable()).toBe(true);
    withContext({ requestId: "injected" }, () => {
      expect(getContext()).toEqual({ requestId: "injected" });
    });
  });

  test("builtin loader skips throwing ids and modules without AsyncLocalStorage", () => {
    const original = process.getBuiltinModule.bind(process);
    process.getBuiltinModule = ((id: string) => {
      if (id === "async_hooks") {
        throw new Error("async_hooks unavailable");
      }
      return {};
    }) as typeof process.getBuiltinModule;
    try {
      setAlsConstructorForTests(undefined);
      expect(isAsyncLocalStorageAvailable()).toBe(false);
      expect(isAsyncLocalStorageAvailable()).toBe(false);
    } finally {
      process.getBuiltinModule = original;
      setAlsConstructorForTests(undefined);
    }
  });

  test("builtin loader skips when getBuiltinModule is missing", () => {
    const original = process.getBuiltinModule;
    // @ts-expect-error intentional removal for soft-load coverage
    delete process.getBuiltinModule;
    try {
      setAlsConstructorForTests(undefined);
      expect(isAsyncLocalStorageAvailable()).toBe(false);
    } finally {
      process.getBuiltinModule = original;
      setAlsConstructorForTests(undefined);
    }
  });

  test("builtin loader skips non-object modules and missing process", () => {
    const originalBuiltin = process.getBuiltinModule.bind(process);
    process.getBuiltinModule = (() => 42) as typeof process.getBuiltinModule;
    try {
      setAlsConstructorForTests(undefined);
      expect(isAsyncLocalStorageAvailable()).toBe(false);
    } finally {
      process.getBuiltinModule = originalBuiltin;
      setAlsConstructorForTests(undefined);
    }
    const savedProcess = globalThis.process;
    Reflect.deleteProperty(globalThis, "process");
    try {
      setAlsConstructorForTests(undefined);
      expect(isAsyncLocalStorageAvailable()).toBe(false);
    } finally {
      globalThis.process = savedProcess;
      setAlsConstructorForTests(undefined);
    }
  });

  test("resolves real ALS constructor on Node and Bun", () => {
    expect(isAsyncLocalStorageAvailable()).toBe(true);
    expect(isAsyncLocalStorageAvailable()).toBe(true);
    withContext({ requestId: "live" }, () => {
      expect(getContext()).toEqual({ requestId: "live" });
    });
  });
});

describe("http logger option paths", () => {
  test("httpLogger returns provided logger", () => {
    const logger = createLogger({ sink: capturingSink(), clock: fixedClock });
    expect(httpLogger({ logger })).toBe(logger);
  });

  test("allocateRequestId uses existing header", () => {
    expect(allocateRequestId("abc")).toBe("abc");
  });

  test("allocateRequestId uses randomId and fallback", () => {
    expect(allocateRequestId(null, () => "generated")).toBe("generated");
    expect(
      allocateRequestId("", () => {
        throw new Error("no crypto");
      })
    ).toMatch(/^req_/);
  });

  test("defaultRandomId falls back without randomUUID", () => {
    expect(defaultRandomId(null)).toMatch(/^req_/);
    expect(fallbackRequestId(() => 12345)).toMatch(
      new RegExp(`^req_${(12345).toString(36)}_[0-9a-z]+$`)
    );
  });
});

describe("sanitize and timestamp edges", () => {
  test("sanitizeError catch path", () => {
    const err = new Error("x");
    Object.defineProperty(err, "name", {
      get() {
        throw new Error("name failed");
      },
    });
    expect(sanitizeError(err)).toEqual({
      error: { name: "Error", message: "<sanitization_failed>" },
    });
  });

  test("sanitizeValue catch path via hostile object", () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("keys failed");
        },
        getOwnPropertyDescriptor() {
          throw new Error("desc failed");
        },
      }
    );
    expect(sanitizeValue(proxy, 0, new WeakSet())).toBe("<unprintable>");
  });

  test("sanitizeHash max depth at entry", () => {
    expect(sanitizeHash({ a: 1 }, MAX_DEPTH + 1)).toEqual({
      error: "max_depth_exceeded",
    });
  });

  test("sanitizeError without stack", () => {
    const err = new Error("nostack");
    Object.defineProperty(err, "stack", { value: undefined });
    const result = sanitizeError(err);
    expect((result.error as { stack?: string }).stack).toBeUndefined();
  });

  test("currentTimestamp falls back when perf throws", () => {
    const stamp = currentTimestamp(undefined, {
      timeOrigin: 0,
      now() {
        throw new Error("perf down");
      },
    });
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("currentTimestamp falls back when perf missing", () => {
    const stamp = currentTimestamp(undefined, null);
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test("defaultPerformance rejects incomplete perf", () => {
    expect(defaultPerformance(null)).toBeUndefined();
    expect(defaultPerformance({})).toBeUndefined();
    expect(defaultPerformance({ now: () => 1, timeOrigin: 0 })).toBeTruthy();
    expect(defaultPerformance()).toBeTruthy();
  });
});
