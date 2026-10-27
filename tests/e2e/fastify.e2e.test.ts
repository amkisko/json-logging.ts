import { beforeEach, describe, expect, test } from "bun:test";
import Fastify from "fastify";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { withFastifyLogging } from "../../src/fastify.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { parseLine } from "../helpers.js";
import { contextFromLines, e2eLogger } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e fastify", () => {
  test("real Fastify inject retains ALS and completion", async () => {
    const { sink, logger } = e2eLogger();
    const app = Fastify();
    app.get(
      "/items",
      withFastifyLogging(
        async (_request, reply) => {
          await Promise.resolve();
          httpLogger().info({ event: "handler" });
          return reply.code(201).send("ok");
        },
        { logger, logCompletion: true }
      )
    );

    const response = await app.inject({
      method: "GET",
      url: "/items?q=1",
      headers: { "x-request-id": "fastify-e2e-1" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.body).toBe("ok");
    await app.close();

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "fastify-e2e-1",
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
