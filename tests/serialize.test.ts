import { describe, expect, test } from "bun:test";
import {
  buildFallbackRecord,
  buildRecord,
  currentTimestamp,
  formatTimestamp,
  parseMessage,
  toJsonLine,
} from "../src/serialize.js";

describe("timestamps", () => {
  test("formatTimestamp uses ISO8601 with Z", () => {
    const stamp = formatTimestamp(new Date("2026-01-01T00:00:00.123Z"));
    expect(stamp).toBe("2026-01-01T00:00:00.123Z");
    expect(stamp.endsWith("Z")).toBe(true);
  });

  test("currentTimestamp with clock uses milliseconds and Z", () => {
    const stamp = currentTimestamp(() => new Date("2026-01-01T00:00:00.000Z"));
    expect(stamp).toBe("2026-01-01T00:00:00.000Z");
    expect(stamp.endsWith("Z")).toBe(true);
  });

  test("currentTimestamp without clock prefers microseconds and Z", () => {
    const stamp = currentTimestamp();
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    expect(stamp.endsWith("Z")).toBe(true);
  });
});

describe("parseMessage", () => {
  test("parses string object and error", () => {
    expect(parseMessage("hi")).toEqual({ message: "hi" });
    expect(parseMessage({ a: 1 }).a).toBe(1);
    expect(parseMessage(new Error("e")).error).toBeTruthy();
  });
});

describe("buildRecord and fallback", () => {
  test("toJsonLine ends with newline", () => {
    const line = toJsonLine({ a: 1 });
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line)).toEqual({ a: 1 });
  });

  test("buildFallbackRecord shapes logger_error", () => {
    const record = buildFallbackRecord(
      "error",
      "msg",
      new Error("fail"),
      () => new Date("2026-01-01T00:00:00.000Z")
    );
    expect(record.severity).toBe("ERROR");
    expect(record.message).toBe("msg");
    expect(record.logger_error).toEqual({
      name: "Error",
      message: "fail",
    });
  });

  test("buildFallbackRecord handles non-error and Error message", () => {
    const fromErrorMessage = buildFallbackRecord(
      "info",
      new Error("orig"),
      "string-fail",
      () => new Date("2026-01-01T00:00:00.000Z")
    );
    expect(fromErrorMessage.message).toBe("orig");
    expect((fromErrorMessage.logger_error as { message: string }).message).toBe("string-fail");

    const fromObject = buildFallbackRecord(
      "info",
      { weird: true },
      123,
      () => new Date("2026-01-01T00:00:00.000Z")
    );
    expect(fromObject.message).toBe("<unprintable>");
  });

  test("buildRecord merges base and message", () => {
    const record = buildRecord({
      message: { event: "x", severity: "NO" },
      level: "info",
      stickyTags: ["t"],
      base: { service: "api", tags: "bad" },
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(record.service).toBe("api");
    expect(record.event).toBe("x");
    expect(record.severity).toBe("INFO");
    expect(record.tags).toEqual(["t"]);
    expect((record.context as Record<string, unknown>).severity).toBe("NO");
    expect((record.context as Record<string, unknown>).tags).toBe("bad");
  });

  test("reserved system keys from message overflow under context", () => {
    const record = buildRecord({
      message: {
        timestamp: "fake",
        message: "user-msg",
        tags: "bad-tag",
        ok: true,
      },
      level: "warn",
      stickyTags: [],
      clock: () => new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(record.severity).toBe("WARN");
    expect(record.timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(String(record.timestamp).endsWith("Z")).toBe(true);
    expect(record.ok).toBe(true);
    const context = record.context as Record<string, unknown>;
    expect(context.timestamp).toBe("fake");
    expect(context.message).toBe("user-msg");
    expect(context.tags).toBe("bad-tag");
  });
});
