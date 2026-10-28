import { beforeEach, describe, expect, test } from "bun:test";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../src/context.js";
import { createLogger } from "../src/json-logging.js";
import {
  applyCompiledRedact,
  applyCompiledRedactPaths,
  compileRedact,
  compileRedactPaths,
  hasRedactWork,
} from "../src/redact.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
});

describe("compileRedact and censor modes", () => {
  test("array form matches filtered path redact", () => {
    const compiled = compileRedact(["user.password"]);
    const out = applyCompiledRedact({ user: { password: "x", name: "a" } }, compiled) as {
      user: { password: string; name: string };
    };
    expect(out.user.password).toBe("[FILTERED]");
    expect(out.user.name).toBe("a");
  });

  test("keys redact matching names anywhere", () => {
    const compiled = compileRedact({ keys: ["token"] });
    const out = applyCompiledRedact(
      { token: "a", nested: { token: "b", ok: 1 } },
      compiled
    ) as Record<string, unknown>;
    expect(out.token).toBe("[FILTERED]");
    const nested = out.nested as Record<string, unknown>;
    expect(nested.token).toBe("[FILTERED]");
    expect(nested.ok).toBe(1);
  });

  test("caseInsensitive keys match", () => {
    const compiled = compileRedact({ keys: ["apiKey"], caseInsensitive: true });
    const out = applyCompiledRedact({ APIKEY: "x", apiKey: "y" }, compiled) as Record<
      string,
      unknown
    >;
    expect(out.APIKEY).toBe("[FILTERED]");
    expect(out.apiKey).toBe("[FILTERED]");
  });

  test("censor remove drops object keys and nulls array slots", () => {
    const compiled = compileRedact({
      paths: ["user.password", "items.1"],
      keys: ["secret"],
      censor: "remove",
    });
    const out = applyCompiledRedact(
      {
        user: { password: "x", name: "a" },
        items: ["keep", "hide"],
        secret: "z",
        ok: true,
      },
      compiled
    ) as Record<string, unknown>;
    expect(out.user).toEqual({ name: "a" });
    expect(out.items).toEqual(["keep", null]);
    expect(out.secret).toBeUndefined();
    expect(out.ok).toBe(true);
  });

  test("censor hash is stable for the same string", () => {
    const compiled = compileRedact({ paths: ["password"], censor: "hash" });
    const first = applyCompiledRedact({ password: "secret" }, compiled) as {
      password: string;
    };
    const second = applyCompiledRedact({ password: "secret" }, compiled) as {
      password: string;
    };
    expect(first.password).toBe(second.password);
    expect(first.password).toMatch(/^\[hash:[0-9a-f]{8}\]$/);
    expect(first.password).not.toContain("secret");
  });

  test("custom censor function and hashLabel", () => {
    const compiled = compileRedact({
      keys: ["pin"],
      censor: (value) => `x:${String(value).length}`,
    });
    const out = applyCompiledRedact({ pin: "12" }, compiled) as { pin: string };
    expect(out.pin).toBe("x:2");

    const hashed = compileRedact({
      paths: ["a"],
      censor: "hash",
      hashLabel: "id",
    });
    const record = applyCompiledRedact({ a: "v" }, hashed) as { a: string };
    expect(record.a).toMatch(/^\[id:[0-9a-f]{8}\]$/);
  });

  test("hash fingerprints circular values and empty hashLabel", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const compiled = compileRedact({
      paths: ["self"],
      censor: "hash",
      hashLabel: "",
    });
    const out = applyCompiledRedact(circular, compiled) as { self: string };
    expect(out.self).toMatch(/^\[hash:[0-9a-f]{8}\]$/);
  });

  test("skips empty keys and reports hasRedactWork", () => {
    expect(hasRedactWork(compileRedact(undefined))).toBe(false);
    expect(hasRedactWork(compileRedact({ keys: [""] }))).toBe(false);
    expect(hasRedactWork(compileRedact({ keys: ["pin"] }))).toBe(true);
    const paths = compileRedactPaths(["a.b"]);
    expect(applyCompiledRedactPaths({ a: { b: 1 } }, paths)).toEqual({
      a: { b: "[FILTERED]" },
    });
  });

  test("remove censor on object wildcard drops every child", () => {
    const compiled = compileRedact({ paths: ["bag.*"], censor: "remove" });
    expect(applyCompiledRedact({ bag: { a: 1, b: 2 } }, compiled)).toEqual({ bag: {} });
  });

  test("hash non-string leaves that JSON.stringify omits", () => {
    const compiled = compileRedact({ paths: ["fn"], censor: "hash" });
    const out = applyCompiledRedact({ fn: () => "x" }, compiled) as { fn: string };
    expect(out.fn).toMatch(/^\[hash:[0-9a-f]{8}\]$/);
  });
});

describe("logger redact options", () => {
  test("accepts RedactOptions on createLogger", () => {
    const sink = capturingSink();
    const logger = createLogger({
      sink,
      clock: fixedClock,
      redact: {
        paths: ["user.token"],
        keys: ["ssn"],
        censor: "remove",
      },
    });
    logger.info({ user: { token: "abc", id: 1 }, ssn: "9", event: "ok" });
    const record = parseLine(sink.entries[0]!.line);
    const user = record.user as Record<string, unknown>;
    expect(user.token).toBeUndefined();
    expect(user.id).toBe(1);
    expect(record.ssn).toBeUndefined();
    expect(record.event).toBe("ok");
  });

  test("child inherits RedactOptions", () => {
    const sink = capturingSink();
    const parent = createLogger({
      sink,
      clock: fixedClock,
      redact: { keys: ["pin"], censor: "hash" },
    });
    parent.child({ service: "x" }).info({ pin: "hide", n: 1 });
    const record = parseLine(sink.entries[0]!.line);
    expect(String(record.pin)).toMatch(/^\[hash:[0-9a-f]{8}\]$/);
    expect(record.n).toBe(1);
    expect(record.service).toBe("x");
  });

  test("buildRecord accepts path-array compiledRedact and empty plan", async () => {
    const { buildRecord } = await import("../src/serialize.js");
    const paths = compileRedactPaths(["user.token"]);
    const withPaths = buildRecord({
      message: { user: { token: "abc" } },
      level: "info",
      stickyTags: [],
      clock: fixedClock,
      compiledRedact: paths,
    });
    expect((withPaths.user as Record<string, unknown>).token).toBe("[FILTERED]");

    const empty = buildRecord({
      message: { keep: 1 },
      level: "info",
      stickyTags: [],
      clock: fixedClock,
      compiledRedact: compileRedact(undefined),
    });
    expect(empty.keep).toBe(1);

    const emptyPaths = buildRecord({
      message: { keep: 2 },
      level: "info",
      stickyTags: [],
      clock: fixedClock,
      compiledRedact: [],
    });
    expect(emptyPaths.keep).toBe(2);
  });
});
