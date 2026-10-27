import { beforeEach, describe, expect, test } from "bun:test";
import { getContext, resetContextStorageForTests, setAlsOverrideForTests } from "../src/context.js";
import { bindHttpLogger, httpLogger, resetHttpLoggerForTests } from "../src/http.js";
import { createLogger } from "../src/json-logging.js";
import { withRequestLogging } from "../src/next.js";
import { withRemixContext } from "../src/remix.js";
import { capturingSink, fixedClock } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("next helpers", () => {
  test("withRequestLogging sets request context", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    bindHttpLogger(logger);

    const handler = withRequestLogging(async (req) => {
      expect(getContext()?.requestId).toBe("fixed-id");
      expect(getContext()?.method).toBe("GET");
      expect(getContext()?.path).toBe("/hello");
      httpLogger().info("mw");
      return { ok: true, path: req.nextUrl?.pathname };
    });

    const headers = new Headers({ "x-request-id": "fixed-id" });
    const result = await handler({
      headers,
      method: "GET",
      nextUrl: { pathname: "/hello" },
    });
    expect(result).toEqual({ ok: true, path: "/hello" });
    expect(sink.entries[0]!.record.context).toMatchObject({
      requestId: "fixed-id",
    });
  });

  test("allocates request id and parses url path", async () => {
    const seen: Record<string, unknown>[] = [];
    const handler = withRequestLogging(
      async () => {
        seen.push({ ...getContext()! });
        return "done";
      },
      {
        headerName: "x-corr-id",
        logger: createLogger({ sink: capturingSink() }),
      }
    );
    await handler({
      headers: new Headers(),
      method: "POST",
      url: "https://example.com/items?x=1",
    });
    expect(seen[0]!.method).toBe("POST");
    expect(seen[0]!.path).toBe("/items");
    expect(typeof seen[0]!.requestId).toBe("string");
  });

  test("falls back when url is invalid", async () => {
    let path: unknown;
    const handler = withRequestLogging(async () => {
      path = getContext()?.path;
      return null;
    });
    await handler({ headers: new Headers(), url: "http://[?token=secret" });
    expect(path).toBe("http://[");
  });

  test("omits path when request has no url", async () => {
    let ctx: Record<string, unknown> | undefined;
    const handler = withRequestLogging(async () => {
      ctx = { ...getContext()! };
      return null;
    });
    await handler({ headers: new Headers({ "x-request-id": "only-id" }) });
    expect(ctx?.requestId).toBe("only-id");
    expect(ctx?.path).toBeUndefined();
  });
});

describe("remix helpers", () => {
  test("withRemixContext merges request and allowlisted bag keys", async () => {
    const sink = capturingSink();
    bindHttpLogger(createLogger({ sink, clock: fixedClock }));

    await withRemixContext(
      {
        request: {
          method: "GET",
          url: "https://app.test/users",
          headers: new Headers({ "x-request-id": "from-header" }),
        },
        context: { userId: 9, db: { secret: true } },
      },
      () => {
        httpLogger().info("load");
        expect(getContext()?.userId).toBe(9);
        expect(getContext()?.db).toBeUndefined();
        expect(getContext()?.requestId).toBe("from-header");
        expect(getContext()?.path).toBe("/users");
      },
      { contextKeys: ["userId"] }
    );
    expect(sink.entries[0]!.record.context).toMatchObject({
      userId: 9,
      requestId: "from-header",
    });
    expect((sink.entries[0]!.record.context as Record<string, unknown>).db).toBeUndefined();
  });

  test("withRemixContext does not leak full load context by default", () => {
    let ctx: Record<string, unknown> | undefined;
    withRemixContext(
      {
        request: { method: "GET", url: "https://app.test/" },
        context: { session: "secret", token: "t" },
      },
      () => {
        ctx = getContext();
      }
    );
    expect(ctx?.session).toBeUndefined();
    expect(ctx?.token).toBeUndefined();
    expect(typeof ctx?.requestId).toBe("string");
  });

  test("prefers context requestId and handles bad url", () => {
    let ctx: Record<string, unknown> | undefined;
    withRemixContext(
      {
        request: { url: ":::bad", method: "PUT" },
        context: { requestId: "ctx-id" },
      },
      () => {
        ctx = getContext();
      }
    );
    expect(ctx?.requestId).toBe("ctx-id");
    expect(ctx?.path).toBe("/:::bad");
    expect(ctx?.method).toBe("PUT");
  });

  test("allocates requestId when none provided", () => {
    let ctx: Record<string, unknown> | undefined;
    withRemixContext({ request: { method: "GET" }, context: {} }, () => {
      ctx = getContext();
    });
    expect(typeof ctx?.requestId).toBe("string");
    expect(String(ctx?.requestId).length).toBeGreaterThan(0);
    expect(ctx?.method).toBe("GET");
  });

  test("httpLogger creates ambient logger once", () => {
    const logger = httpLogger({
      loggerOptions: { sink: capturingSink() },
    });
    expect(httpLogger()).toBe(logger);
  });
});
