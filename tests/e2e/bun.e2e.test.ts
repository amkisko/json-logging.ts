import { beforeEach, describe, expect, test } from "bun:test";
import { withBunLogging } from "../../src/bun-serve.js";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { parseLine } from "../helpers.js";
import { contextFromLines, e2eLogger } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e bun.serve", () => {
  test("real Bun.serve retains ALS and completion", async () => {
    const { sink, logger } = e2eLogger();
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: withBunLogging(
        async (request) => {
          await Promise.resolve();
          httpLogger().info({ event: "handler" });
          expect(new URL(request.url).pathname).toBe("/items");
          return new Response("ok", { status: 201 });
        },
        { logger, logCompletion: true }
      ),
    });

    try {
      const response = await fetch(`${server.url}items?q=1`, {
        headers: { "x-request-id": "bun-e2e-1" },
      });
      expect(response.status).toBe(201);
      expect(await response.text()).toBe("ok");
    } finally {
      server.stop(true);
    }

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "bun-e2e-1",
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
