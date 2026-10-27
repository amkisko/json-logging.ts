import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { withHonoLogging } from "../../src/hono.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { parseLine } from "../helpers.js";
import { contextFromLines, e2eLogger } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e hono", () => {
  test("real Hono app retains ALS context and completion", async () => {
    const { sink, logger } = e2eLogger();
    const app = new Hono();
    app.use(withHonoLogging({ logger, logCompletion: true }));
    app.get("/items", (c) => {
      httpLogger().info({ event: "handler" });
      return c.text("ok", 201);
    });

    const response = await app.request("/items", {
      headers: { "x-request-id": "hono-e2e-1" },
    });
    expect(response.status).toBe(201);
    expect(await response.text()).toBe("ok");

    const handler = sink.entries.find((entry) => entry.record.event === "handler");
    expect(handler).toBeDefined();
    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "hono-e2e-1",
      method: "GET",
      path: "/items",
    });

    const completion = sink.entries.find((entry) => entry.record.event === "http_request");
    expect(completion).toBeDefined();
    expect(parseLine(completion!.line)).toMatchObject({
      event: "http_request",
      status: 201,
      method: "GET",
      path: "/items",
      severity: "INFO",
    });
  });
});
