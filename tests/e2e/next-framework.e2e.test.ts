import { beforeEach, describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { withRequestLogging } from "../../src/next.js";
import { contextFromLines, e2eLogger } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e next NextRequest", () => {
  test("real NextRequest keeps ALS after await via withRequestLogging", async () => {
    const { sink, logger } = e2eLogger();
    const handler = withRequestLogging(
      async (req) => {
        await Promise.resolve();
        httpLogger().info({
          event: "next-middleware",
          path: req.nextUrl?.pathname,
        });
        return new Response("ok", { status: 201 });
      },
      { logger }
    );

    const request = new NextRequest("https://example.test/items?q=1", {
      method: "GET",
      headers: { "x-request-id": "next-fw-1" },
    });
    const response = await handler(request);
    expect(response.status).toBe(201);
    expect(request).toBeInstanceOf(NextRequest);
    expect(request.nextUrl.pathname).toBe("/items");

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "next-fw-1",
      method: "GET",
      path: "/items",
    });
    expect(sink.entries[0]!.record.event).toBe("next-middleware");
  });
});
