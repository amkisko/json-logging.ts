import { beforeEach, describe, expect, test } from "bun:test";
import { createServer } from "node:http";
import express from "express";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { withExpressLogging } from "../../src/express.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { parseLine } from "../helpers.js";
import { contextFromLines, e2eLogger, listenHttp } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e express", () => {
  test("real Express app retains ALS across async handler and finish", async () => {
    const { sink, logger } = e2eLogger();
    const app = express();
    app.use(withExpressLogging({ logger, logCompletion: true }));
    app.get("/items", async (_req, res) => {
      await Promise.resolve();
      httpLogger().info({ event: "handler" });
      res.status(201).send("ok");
    });

    const { baseUrl, close } = await listenHttp(createServer(app));
    try {
      const response = await fetch(`${baseUrl}/items?q=1`, {
        headers: { "x-request-id": "express-e2e-1" },
      });
      expect(response.status).toBe(201);
      expect(await response.text()).toBe("ok");
    } finally {
      await close();
    }

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "express-e2e-1",
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
