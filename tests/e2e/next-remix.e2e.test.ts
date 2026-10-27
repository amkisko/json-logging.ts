import { beforeEach, describe, expect, test } from "bun:test";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { withRequestLogging } from "../../src/next.js";
import { withRemixContext } from "../../src/remix.js";
import { contextFromLines, e2eLogger } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("e2e next and remix request surface", () => {
  test("contextFromLines skips records without context", () => {
    expect(contextFromLines([])).toBeUndefined();
    expect(contextFromLines([{ record: { event: "bare" } }])).toBeUndefined();
  });

  test("Next wrapper keeps ALS on real Request after await", async () => {
    const { sink, logger } = e2eLogger();
    const handler = withRequestLogging(
      async (req) => {
        await Promise.resolve();
        httpLogger().info({ event: "next-handler", path: req.nextUrl?.pathname });
        return new Response("ok", { status: 201 });
      },
      { logger }
    );

    const request = new Request("https://example.test/items?q=1", {
      method: "GET",
      headers: { "x-request-id": "next-e2e-1" },
    });
    Object.defineProperty(request, "nextUrl", {
      value: { pathname: "/items" },
    });

    const response = await handler(request);
    expect(response.status).toBe(201);

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "next-e2e-1",
      method: "GET",
      path: "/items",
    });
    expect(sink.entries[0]!.record.event).toBe("next-handler");
  });

  test("Remix wrapper keeps ALS on real Request and allowlisted context", async () => {
    const { sink, logger } = e2eLogger();
    const request = new Request("https://example.test/load", {
      method: "POST",
      headers: { "x-request-id": "remix-e2e-1" },
    });

    const body = await withRemixContext(
      { request, context: { requestId: "remix-e2e-1", userId: "u1", secret: "nope" } },
      async () => {
        await Promise.resolve();
        httpLogger().info({ event: "remix-loader" });
        return "loaded";
      },
      { logger, contextKeys: ["userId"] }
    );

    expect(body).toBe("loaded");
    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "remix-e2e-1",
      method: "POST",
      path: "/load",
      userId: "u1",
    });
    expect(contextFromLines(sink.entries)?.secret).toBeUndefined();
  });
});
