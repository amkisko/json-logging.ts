import { beforeEach, describe, expect, test } from "bun:test";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../src/context.js";
import { createLogger } from "../src/json-logging.js";
import { applyRedactPaths } from "../src/redact.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
});

describe("isLevelEnabled", () => {
  test("reports enabled levels without writing", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, level: "warn", clock: fixedClock });
    expect(logger.isLevelEnabled("debug")).toBe(false);
    expect(logger.isLevelEnabled("info")).toBe(false);
    expect(logger.isLevelEnabled("warn")).toBe(true);
    expect(logger.isLevelEnabled("error")).toBe(true);
    expect(sink.entries).toHaveLength(0);
  });
});

describe("applyRedactPaths", () => {
  test("filters nested paths and wildcards", () => {
    const input = {
      user: { password: "secret", name: "a" },
      headers: { authorization: "tok", accept: "json" },
      items: [
        { secret: "x", ok: 1 },
        { secret: "y", ok: 2 },
      ],
    };
    const out = applyRedactPaths(input, [
      "user.password",
      "headers.authorization",
      "items.*.secret",
    ]) as Record<string, unknown>;
    const user = out.user as Record<string, unknown>;
    expect(user.password).toBe("[FILTERED]");
    expect(user.name).toBe("a");
    const headers = out.headers as Record<string, unknown>;
    expect(headers.authorization).toBe("[FILTERED]");
    expect(headers.accept).toBe("json");
    const items = out.items as Record<string, unknown>[];
    expect(items[0]!.secret).toBe("[FILTERED]");
    expect(items[0]!.ok).toBe(1);
    expect(items[1]!.secret).toBe("[FILTERED]");
  });

  test("ignores empty and invalid paths", () => {
    const input = { a: 1 };
    expect(applyRedactPaths(input, ["", ".", "a..b"])).toEqual({ a: 1 });
  });

  test("redacts array indexes and skips missing keys", () => {
    const input = { items: ["keep", "hide"], plain: "x" };
    const out = applyRedactPaths(input, [
      "items.1",
      "items.9",
      "missing.path",
      "plain.nested",
    ]) as Record<string, unknown>;
    expect(out.items).toEqual(["keep", "[FILTERED]"]);
    expect(out.plain).toBe("x");
  });

  test("object wildcard redacts every child leaf", () => {
    const out = applyRedactPaths({ bag: { a: 1, b: 2 } }, ["bag.*"]) as Record<string, unknown>;
    expect(out.bag).toEqual({ a: "[FILTERED]", b: "[FILTERED]" });
  });
});

describe("logger redact and serializers", () => {
  test("redacts configured paths on logged objects", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      redact: ["user.token"],
    });
    logger.info({ user: { token: "abc", id: 1 }, event: "ok" });
    const record = parseLine(sink.entries[0]!.line);
    const user = record.user as Record<string, unknown>;
    expect(user.token).toBe("[FILTERED]");
    expect(user.id).toBe(1);
    expect(record.event).toBe("ok");
  });

  test("buildRecord accepts string redact paths without compiled list", async () => {
    const { buildRecord } = await import("../src/serialize.js");
    const record = buildRecord({
      message: { user: { token: "abc" } },
      level: "info",
      stickyTags: [],
      clock: fixedClock,
      redact: ["user.token"],
    });
    const user = record.user as Record<string, unknown>;
    expect(user.token).toBe("[FILTERED]");
  });

  test("applies root serializers before redact", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      redact: ["payload.secret"],
      serializers: {
        payload: (value) => {
          const obj = value as Record<string, unknown>;
          return { ...obj, wrapped: true };
        },
      },
    });
    logger.info({ payload: { secret: "x", n: 2 } });
    const record = parseLine(sink.entries[0]!.line);
    const payload = record.payload as Record<string, unknown>;
    expect(payload.wrapped).toBe(true);
    expect(payload.secret).toBe("[FILTERED]");
    expect(payload.n).toBe(2);
  });

  test("serializer throw uses never-raise fallback", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      serializers: {
        boom: () => {
          throw new Error("serializer failed");
        },
      },
    });
    logger.info({ boom: 1, message: "hi" });
    expect(sink.entries).toHaveLength(1);
    const record = parseLine(sink.entries[0]!.line);
    expect(record.logger_error).toBeDefined();
  });

  test("child inherits redact and serializers", () => {
    const sink = capturingSink();
    const parent = createLogger({
      sink,
      clock: fixedClock,
      redact: ["secret"],
      serializers: {
        n: (value) => Number(value) + 1,
      },
    });
    const child = parent.child({ service: "x" });
    child.info({ secret: "hide", n: 1 });
    const record = parseLine(sink.entries[0]!.line);
    expect(record.secret).toBe("[FILTERED]");
    expect(record.n).toBe(2);
    expect(record.service).toBe("x");
  });
});
