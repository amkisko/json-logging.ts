import { beforeEach, describe, expect, test } from "bun:test";
import {
  getContext,
  resetContextStorageForTests,
  setAlsOverrideForTests,
  withContext,
} from "../src/context.js";
import { createLogger, JsonLogging } from "../src/json-logging.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
});

describe("createLogger / JsonLogging.new", () => {
  test("logs string messages as JSON lines", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock, level: "debug" });
    logger.info("hello");
    expect(sink.entries).toHaveLength(1);
    const record = parseLine(sink.entries[0]!.line);
    expect(record.message).toBe("hello");
    expect(record.severity).toBe("INFO");
    expect(record.timestamp).toBe("2026-10-26T05:30:00.000Z");
  });

  test("JsonLogging.new mirrors createLogger", () => {
    const sink = capturingSink();
    const logger = JsonLogging.new({ sink, clock: fixedClock });
    logger.warn("careful");
    expect(parseLine(sink.entries[0]!.line).severity).toBe("WARN");
  });

  test("respects level filtering", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, level: "warn", clock: fixedClock });
    logger.debug("no");
    logger.info("no");
    logger.warn("yes");
    logger.error("yes");
    logger.fatal("yes");
    expect(sink.entries).toHaveLength(3);
  });

  test("merges object fields at root", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    logger.info({ event: "signup", userId: 42 });
    const record = parseLine(sink.entries[0]!.line);
    expect(record.event).toBe("signup");
    expect(record.userId).toBe(42);
    expect(record.message).toBeUndefined();
  });

  test("serializes Error under error key", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const err = new Error("boom");
    logger.error(err);
    const record = parseLine(sink.entries[0]!.line);
    const error = record.error as Record<string, unknown>;
    expect(error.name).toBe("Error");
    expect(error.message).toBe("boom");
    expect(typeof error.stack).toBe("string");
  });

  test("moves system key conflicts into context", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    logger.info({ severity: "FAKE", message: "override", ok: true });
    const record = parseLine(sink.entries[0]!.line);
    expect(record.severity).toBe("INFO");
    expect(record.ok).toBe(true);
    const context = record.context as Record<string, unknown>;
    expect(context.severity).toBe("FAKE");
    expect(context.message).toBe("override");
  });

  test("applies base fields", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      base: { service: "api" },
    });
    logger.info("hi");
    expect(parseLine(sink.entries[0]!.line).service).toBe("api");
  });

  test("construction sanitizes base once so later mutation is ignored", () => {
    const sink = capturingSink();
    const base: Record<string, unknown> = {
      service: "api",
      nested: { token: "secret" },
    };
    const logger = createLogger({ sink, clock: fixedClock, base });
    base.service = "mutated";
    (base.nested as Record<string, unknown>).token = "changed";
    logger.info("hi");
    const record = parseLine(sink.entries[0]!.line);
    expect(record.service).toBe("api");
    expect(record.nested).toEqual({ token: "[FILTERED]" });
  });

  test("construction prepares sticky tags once", () => {
    const sink = capturingSink();
    const tags = ["a", "", "b"] as string[];
    const logger = createLogger({ sink, clock: fixedClock, tags });
    tags.push("c");
    logger.info("hi");
    expect(parseLine(sink.entries[0]!.line).tags).toEqual(["a", "b"]);
  });

  test("child merges bindings", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock }).child({
      component: "billing",
    });
    logger.info("invoice");
    expect(parseLine(sink.entries[0]!.line).component).toBe("billing");
  });
});

describe("tagged", () => {
  test("without callback returns sticky child", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const child = logger.tagged("billing") as ReturnType<typeof createLogger>;
    child.info("ok");
    expect(parseLine(sink.entries[0]!.line).tags).toEqual(["billing"]);
  });

  test("nested sticky tags concatenate", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const child = logger.tagged("a").tagged("b") as ReturnType<typeof createLogger>;
    child.info("x");
    expect(parseLine(sink.entries[0]!.line).tags).toEqual(["a", "b"]);
  });

  test("with sync callback scopes tags", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    logger.tagged("REQUEST", "abc", () => {
      logger.info("processing");
    });
    expect(parseLine(sink.entries[0]!.line).tags).toEqual(["REQUEST", "abc"]);
    logger.info("after");
    expect(parseLine(sink.entries[1]!.line).tags).toBeUndefined();
  });

  test("with async callback scopes tags", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    await logger.tagged("ASYNC", async () => {
      logger.info("inside");
    });
    expect(parseLine(sink.entries[0]!.line).tags).toEqual(["ASYNC"]);
  });

  test("empty tagged returns same logger", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    expect(logger.tagged()).toBe(logger);
  });

  test("sticky plus block tags combine", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock }).tagged("sticky") as ReturnType<
      typeof createLogger
    >;
    logger.tagged("block", () => {
      logger.info("both");
    });
    expect(parseLine(sink.entries[0]!.line).tags).toEqual(["sticky", "block"]);
  });
});

describe("contextProvider", () => {
  test("merges provider fields under context", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      contextProvider: () => ({ trace_id: "abc" }),
    });
    logger.info("ok");
    expect(parseLine(sink.entries[0]!.line).context).toEqual({
      trace_id: "abc",
    });
  });

  test("call-site and ALS context win over provider", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      contextProvider: () => ({
        trace_id: "from-provider",
        requestId: "provider-req",
      }),
    });
    withContext({ requestId: "als-req" }, () => {
      logger.info({ context: { trace_id: "from-message" } });
    });
    expect(parseLine(sink.entries[0]!.line).context).toEqual({
      requestId: "als-req",
      trace_id: "from-message",
    });
  });

  test("provider throw takes never-raise fallback", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      contextProvider: () => {
        throw new Error("provider-boom");
      },
    });
    logger.info("ok");
    expect(sink.entries).toHaveLength(1);
    const record = parseLine(sink.entries[0]!.line);
    expect(record.message).toBe("ok");
    expect(record.logger_error).toEqual({
      name: "Error",
      message: "provider-boom",
    });
  });

  test("undefined or system-only provider leaves context empty", () => {
    const sink = capturingSink();
    const empty = createLogger({
      sink,
      clock: fixedClock,
      contextProvider: () => undefined,
    });
    empty.info("a");
    expect(parseLine(sink.entries[0]!.line).context).toBeUndefined();
    const systemOnly = createLogger({
      sink,
      clock: fixedClock,
      contextProvider: () => ({ severity: "NOPE", message: "x" }),
    });
    systemOnly.info("b");
    expect(parseLine(sink.entries[1]!.line).context).toBeUndefined();
  });
});

describe("withContext", () => {
  test("adds context to log lines", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    withContext({ requestId: "r1" }, () => {
      logger.info("ok");
      expect(getContext()?.requestId).toBe("r1");
    });
    expect(parseLine(sink.entries[0]!.line).context).toEqual({
      requestId: "r1",
    });
    expect(getContext()).toBeUndefined();
  });

  test("nests and restores", () => {
    withContext({ a: 1 }, () => {
      expect(getContext()).toEqual({ a: 1 });
      withContext({ b: 2 }, () => {
        expect(getContext()).toEqual({ a: 1, b: 2 });
      });
      expect(getContext()).toEqual({ a: 1 });
    });
  });

  test("filters system keys from context bag", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    withContext({ requestId: "x", severity: "NOPE" }, () => {
      logger.info("ok");
    });
    const context = parseLine(sink.entries[0]!.line).context as Record<string, unknown>;
    expect(context.requestId).toBe("x");
    expect(context.severity).toBeUndefined();
  });

  test("runs without ALS when override is null", () => {
    setAlsOverrideForTests(null);
    let ran = false;
    withContext({ a: 1 }, () => {
      ran = true;
      expect(getContext()).toBeUndefined();
    });
    expect(ran).toBe(true);
  });
});
