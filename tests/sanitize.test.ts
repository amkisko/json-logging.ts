import { describe, expect, test } from "bun:test";
import {
  isSensitiveKey,
  MAX_CONTEXT_SIZE,
  MAX_DEPTH,
  MAX_STRING_LENGTH,
  prepareTags,
  sanitizeError,
  sanitizeHash,
  sanitizeString,
  sanitizeValue,
} from "../src/sanitize.js";

describe("sanitizeString", () => {
  test("strips control characters", () => {
    expect(sanitizeString("a\x00b\x1Fc")).toBe("abc");
  });

  test("truncates long strings", () => {
    const long = "x".repeat(MAX_STRING_LENGTH + 10);
    const result = sanitizeString(long);
    expect(result.endsWith("...[truncated]")).toBe(true);
    expect(result.length).toBe(MAX_STRING_LENGTH + "...[truncated]".length);
  });

  test("returns sanitization_error on throw", () => {
    const bad = {
      toString() {
        throw new Error("nope");
      },
      replace() {
        throw new Error("nope");
      },
      length: 1,
      slice() {
        throw new Error("nope");
      },
    };
    expect(sanitizeString(bad as unknown as string)).toBe("<sanitization_error>");
  });
});

describe("sensitive keys", () => {
  test("detects password secret token authorization api_key", () => {
    expect(isSensitiveKey("password")).toBe(true);
    expect(isSensitiveKey("secret")).toBe(true);
    expect(isSensitiveKey("access_token")).toBe(true);
    expect(isSensitiveKey("Authorization")).toBe(true);
    expect(isSensitiveKey("api_key")).toBe(true);
    expect(isSensitiveKey("api-key")).toBe(true);
    expect(isSensitiveKey("user_name")).toBe(false);
  });

  test("redacts sensitive values in hashes", () => {
    const result = sanitizeHash({
      password: "secret",
      ok: "yes",
    });
    expect(result.password).toBe("[FILTERED]");
    expect(result.ok).toBe("yes");
  });
});

describe("sanitizeValue limits", () => {
  test("marks circular references", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    const result = sanitizeValue(obj, 0, new WeakSet()) as Record<string, unknown>;
    expect(result.self).toBe("[Circular]");
  });

  test("stringifies BigInt", () => {
    expect(sanitizeValue(10n, 0, new WeakSet())).toBe("10");
  });

  test("caps depth", () => {
    let nested: Record<string, unknown> = { v: 0 };
    for (let i = 0; i < MAX_DEPTH + 3; i++) {
      nested = { child: nested };
    }
    const result = sanitizeHash(nested);
    let cursor: unknown = result;
    let depth = 0;
    while (cursor && typeof cursor === "object" && "child" in (cursor as object)) {
      cursor = (cursor as { child: unknown }).child;
      depth += 1;
    }
    expect(depth).toBeLessThanOrEqual(MAX_DEPTH + 1);
    expect(JSON.stringify(result)).toContain("max_depth_exceeded");
  });

  test("caps object keys and array length", () => {
    const big: Record<string, unknown> = {};
    for (let i = 0; i < MAX_CONTEXT_SIZE + 5; i++) {
      big[`k${i}`] = i;
    }
    const hash = sanitizeHash(big);
    expect(hash.__truncated__).toBe(true);
    expect(Object.keys(hash).length).toBe(MAX_CONTEXT_SIZE + 1);

    const arr = Array.from({ length: MAX_CONTEXT_SIZE + 3 }, (_, i) => i);
    const sanitized = sanitizeValue(arr, 0, new WeakSet()) as unknown[];
    expect(sanitized[sanitized.length - 1]).toBe("[truncated]");
    expect(sanitized.length).toBe(MAX_CONTEXT_SIZE + 1);
  });

  test("handles primitives specials and functions", () => {
    expect(sanitizeValue(undefined, 0, new WeakSet())).toBeNull();
    expect(sanitizeValue(null, 0, new WeakSet())).toBeNull();
    expect(sanitizeValue(true, 0, new WeakSet())).toBe(true);
    expect(sanitizeValue(Number.NaN, 0, new WeakSet())).toBe("NaN");
    expect(sanitizeValue(Symbol("s"), 0, new WeakSet())).toBe("Symbol(s)");
    expect(sanitizeValue(function named() {}, 0, new WeakSet())).toBe("[Function named]");
    expect(sanitizeValue(() => {}, 0, new WeakSet())).toBe("[Function anonymous]");
  });

  test("sanitizeError includes cause", () => {
    const cause = new Error("root");
    const err = new Error("wrap", { cause });
    const result = sanitizeError(err);
    const body = result.error as Record<string, unknown>;
    expect(body.message).toBe("wrap");
    expect(body.cause).toBeTruthy();
  });

  test("prepareTags drops empty and nullish", () => {
    expect(prepareTags(["a", "", null, undefined, 2])).toEqual(["a", "2"]);
  });

  test("sanitizeHash recovers from throw", () => {
    const proxy = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("fail");
        },
      }
    );
    expect(sanitizeHash(proxy as Record<string, unknown>)).toEqual({
      sanitization_error: true,
    });
  });
});
