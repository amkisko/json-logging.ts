import { beforeEach, describe, expect, test } from "bun:test";
import { withBunLogging } from "../src/bun-serve.js";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../src/context.js";
import { withExpressLogging } from "../src/express.js";
import { withFastifyLogging } from "../src/fastify.js";
import { withHonoLogging } from "../src/hono.js";
import { logRequestCompletion, resetHttpLoggerForTests } from "../src/http.js";
import { createLogger } from "../src/json-logging.js";
import { withKoaLogging } from "../src/koa.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("http completion", () => {
  test("express logCompletion emits on finish", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const mw = withExpressLogging({ logger, logCompletion: true });
    const listeners: Array<() => void> = [];
    mw(
      {
        method: "GET",
        originalUrl: "/done",
        headers: { "x-request-id": "ec1" },
      },
      {
        statusCode: 204,
        on: (_event, listener) => {
          listeners.push(listener);
        },
      },
      () => {
        // handler body
      }
    );
    expect(listeners).toHaveLength(1);
    listeners[0]!();
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      event: "http_request",
      status: 204,
      method: "GET",
      path: "/done",
      severity: "INFO",
    });
  });

  test("hono logCompletion after next", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const mw = withHonoLogging({ logger, logCompletion: true });
    await mw(
      {
        req: {
          method: "GET",
          url: "https://example.test/hc",
          header: () => undefined,
        },
        res: { status: 201 },
      },
      async () => {
        // handler
      }
    );
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      event: "http_request",
      status: 201,
      path: "/hc",
      severity: "INFO",
    });
  });

  test("koa and fastify logCompletion", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const koaMw = withKoaLogging({ logger, logCompletion: true });
    await koaMw(
      {
        method: "GET",
        path: "/k-done",
        status: 200,
        get: () => "",
      },
      async () => {
        // handler
      }
    );
    const fastifyHandler = withFastifyLogging(async () => "ok", { logger, logCompletion: true });
    await fastifyHandler({ method: "POST", url: "/f-done", headers: {} }, { statusCode: 201 });
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      event: "http_request",
      path: "/k-done",
      status: 200,
    });
    expect(parseLine(sink.entries[1]!.line)).toMatchObject({
      event: "http_request",
      path: "/f-done",
      status: 201,
    });
  });

  test("bun logCompletion uses Response status and errors", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const okHandler = withBunLogging(async () => new Response("ok", { status: 202 }), {
      logger,
      logCompletion: true,
    });
    await okHandler({
      method: "GET",
      url: "https://example.test/bun-ok",
      headers: new Headers(),
    });
    const failHandler = withBunLogging(
      async () => {
        throw new Error("boom");
      },
      { logger, logCompletion: true }
    );
    await expect(
      failHandler({
        method: "GET",
        url: "https://example.test/bun-fail",
        headers: new Headers(),
      })
    ).rejects.toThrow("boom");
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      event: "http_request",
      status: 202,
      path: "/bun-ok",
    });
    expect(parseLine(sink.entries[1]!.line)).toMatchObject({
      event: "http_request",
      status: 500,
      severity: "ERROR",
    });
  });

  test("logRequestCompletion accepts non-Error error values", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    logRequestCompletion(logger, {
      status: 502,
      elapsedMs: 1,
      error: "downstream",
    });
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      severity: "ERROR",
      error: { message: "downstream" },
    });
  });

  test("fastify logCompletion records thrown errors", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const handler = withFastifyLogging(
      async () => {
        throw new Error("route-fail");
      },
      { logger, logCompletion: true }
    );
    await expect(
      handler({ method: "GET", url: "/boom", headers: {} }, { statusCode: 500 })
    ).rejects.toThrow("route-fail");
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      event: "http_request",
      status: 500,
      severity: "ERROR",
    });
  });

  test("bun logCompletion defaults status 200 for non-Response", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const handler = withBunLogging(async () => "plain", {
      logger,
      logCompletion: true,
    });
    await handler({
      method: "GET",
      url: "https://example.test/plain",
      headers: new Headers(),
    });
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      event: "http_request",
      status: 200,
      path: "/plain",
    });
  });

  test("logCompletion without ambient logger is a no-op", async () => {
    resetHttpLoggerForTests();
    const listeners: Array<() => void> = [];
    withExpressLogging({ logCompletion: true })(
      { method: "GET", originalUrl: "/no-logger", headers: {} },
      {
        on: (_event, listener) => {
          listeners.push(listener);
        },
      },
      () => {
        // handler
      }
    );
    listeners[0]!();
    await withHonoLogging({ logCompletion: true })(
      {
        req: {
          method: "GET",
          url: "https://example.test/no-logger",
          header: () => undefined,
        },
      },
      async () => {
        // handler
      }
    );
    await withKoaLogging({ logCompletion: true })(
      { method: "GET", path: "/no-logger", get: () => "" },
      async () => {
        // handler
      }
    );
  });

  test("completion status falls back to zero when missing", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    const listeners: Array<() => void> = [];
    withExpressLogging({ logger, logCompletion: true })(
      { method: "GET", originalUrl: "/z", headers: {} },
      {
        on: (_event, listener) => {
          listeners.push(listener);
        },
      },
      () => {
        // handler
      }
    );
    listeners[0]!();
    await withHonoLogging({ logger, logCompletion: true })(
      {
        req: {
          method: "GET",
          url: "https://example.test/z",
          header: () => undefined,
        },
      },
      async () => {
        // no res
      }
    );
    await withKoaLogging({ logger, logCompletion: true })(
      { method: "GET", path: "/z", get: () => "" },
      async () => {
        // no status
      }
    );
    expect(parseLine(sink.entries[0]!.line).status).toBe(0);
    expect(parseLine(sink.entries[1]!.line).status).toBe(0);
    expect(parseLine(sink.entries[2]!.line).status).toBe(0);
  });
});
