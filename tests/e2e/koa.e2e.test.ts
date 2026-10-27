import { beforeEach, describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import Koa from "koa";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { withKoaLogging } from "../../src/koa.js";
import { parseLine } from "../helpers.js";
import { contextFromLines, e2eLogger, listenHttp } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e koa", () => {
  test("real Koa app retains ALS across await and completion", async () => {
    const { sink, logger } = e2eLogger();
    const app = new Koa();
    app.use(withKoaLogging({ logger, logCompletion: true }));
    app.use(async (ctx) => {
      await Promise.resolve();
      httpLogger().info({ event: "handler" });
      ctx.status = 201;
      ctx.body = "ok";
    });

    const { baseUrl, close } = await listenHttp(createServer(app.callback()));
    try {
      const response = await fetch(`${baseUrl}/items?q=1`, {
        headers: { "x-request-id": "koa-e2e-1" },
      });
      expect(response.status).toBe(201);
      expect(await response.text()).toBe("ok");
    } finally {
      await close();
    }

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "koa-e2e-1",
      method: "GET",
      path: "/items",
    });
    const completion = sink.entries.find((entry) => entry.record.event === "http_request");
    expect(completion).toBeDefined();
    expect(parseLine(completion!.line)).toMatchObject({
      event: "http_request",
      status: 201,
      path: "/items",
      severity: "INFO",
    });
  });
});
