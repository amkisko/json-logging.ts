import { beforeEach, describe, expect, test } from "bun:test";
import { withBunLogging } from "../src/bun-serve.js";
import { getContext, resetContextStorageForTests, setAlsOverrideForTests } from "../src/context.js";
import { withExpressLogging } from "../src/express.js";
import { withFastifyLogging } from "../src/fastify.js";
import { withHonoLogging } from "../src/hono.js";
import { httpLogger, resetHttpLoggerForTests } from "../src/http.js";
import { createLogger } from "../src/json-logging.js";
import { withKoaLogging } from "../src/koa.js";
import { capturingSink, fixedClock } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("framework adapters", () => {
  test("hono middleware sets context", async () => {
    const mw = withHonoLogging();
    let seen: unknown;
    await mw(
      {
        req: {
          method: "GET",
          url: "https://example.test/h",
          header: (name) => (name === "x-request-id" ? "h1" : undefined),
        },
      },
      async () => {
        seen = getContext();
      }
    );
    expect(seen).toMatchObject({ requestId: "h1", method: "GET", path: "/h" });
  });

  test("express middleware sets context", () => {
    const mw = withExpressLogging();
    let seen: unknown;
    mw(
      {
        method: "PUT",
        originalUrl: "/e",
        headers: { "x-request-id": "e1" },
      },
      {},
      () => {
        seen = getContext();
      }
    );
    expect(seen).toMatchObject({ requestId: "e1", method: "PUT", path: "/e" });
  });

  test("fastify route wrap sets context", async () => {
    const handler = withFastifyLogging(async (req) => {
      expect(getContext()?.requestId).toBe("f1");
      return req.url;
    });
    const result = await handler(
      {
        method: "GET",
        url: "/f",
        headers: { "x-request-id": "f1" },
      },
      {}
    );
    expect(result).toBe("/f");
  });

  test("koa middleware sets context", async () => {
    const mw = withKoaLogging();
    let seen: unknown;
    await mw(
      {
        method: "PATCH",
        path: "/k",
        get: (name) => (name === "x-request-id" ? "k1" : ""),
      },
      async () => {
        seen = getContext();
      }
    );
    expect(seen).toMatchObject({
      requestId: "k1",
      method: "PATCH",
      path: "/k",
    });
  });

  test("bun fetch wrap sets context", async () => {
    const handler = withBunLogging(async () => getContext());
    const ctx = await handler({
      method: "DELETE",
      url: "https://example.test/b",
      headers: new Headers({ "x-request-id": "b1" }),
    });
    expect(ctx).toMatchObject({
      requestId: "b1",
      method: "DELETE",
      path: "/b",
    });
  });

  test("express strips query from path and binds factory logger", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const mw = withExpressLogging({ logger });
    mw(
      {
        method: "GET",
        originalUrl: "/e?token=secret",
        headers: { "x-request-id": "e2" },
      },
      {},
      () => {
        expect(getContext()?.path).toBe("/e");
        expect(getContext()?.requestId).toBe("e2");
        httpLogger().info("ok");
      }
    );
    expect(sink.entries[0]!.record.context).toMatchObject({
      path: "/e",
      requestId: "e2",
    });
  });

  test("bun forwards extra fetch arguments", async () => {
    const handler = withBunLogging(async (_req, server: { id: number }) => {
      expect(getContext()?.requestId).toBe("b2");
      return server.id;
    });
    const result = await handler(
      {
        method: "GET",
        url: "https://example.test/b?x=1",
        headers: new Headers({ "x-request-id": "b2" }),
      },
      { id: 7 }
    );
    expect(result).toBe(7);
  });

  test("fastify preserves this for handler.call", async () => {
    const owner = { name: "app" };
    const handler = withFastifyLogging(function (this: { name: string }, req) {
      expect(this.name).toBe("app");
      expect(getContext()?.path).toBe("/f");
      return req.url;
    });
    const result = await handler.call(
      owner,
      {
        method: "GET",
        url: "/f?x=1",
        headers: { "x-request-id": "f2" },
      },
      {}
    );
    expect(result).toBe("/f?x=1");
    expect(getContext()?.path).toBeUndefined();
  });
});
