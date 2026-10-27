import { beforeEach, describe, expect, test } from "bun:test";
import { getContext, resetContextStorageForTests, setAlsOverrideForTests } from "../src/context.js";
import {
  allocateRequestId,
  bindHttpLogger,
  httpFieldsFrom,
  httpLogger,
  logRequestCompletion,
  requestPathFromUrl,
  resetHttpLoggerForTests,
  withHttpContext,
} from "../src/http.js";
import { createLogger } from "../src/json-logging.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

describe("http helpers", () => {
  test("httpFieldsFrom reads Headers and Node-like header maps", () => {
    const fromWeb = httpFieldsFrom({
      method: "GET",
      url: "https://example.test/a?q=1",
      headers: new Headers({ "x-request-id": "web-id" }),
    });
    expect(fromWeb).toMatchObject({
      requestId: "web-id",
      method: "GET",
      path: "/a",
    });

    const fromNode = httpFieldsFrom({
      method: "POST",
      path: "/n",
      headers: { "x-request-id": "node-id" },
    });
    expect(fromNode).toMatchObject({
      requestId: "node-id",
      method: "POST",
      path: "/n",
    });
  });

  test("allocateRequestId keeps valid ids and rejects unsafe ones", () => {
    expect(allocateRequestId("keep")).toBe("keep");
    expect(allocateRequestId("bad id", () => "gen")).toBe("gen");
    expect(allocateRequestId("x".repeat(200), () => "gen")).toBe("gen");
    expect(allocateRequestId(null, () => "gen")).toBe("gen");
    expect(
      allocateRequestId(null, () => {
        throw new Error("no");
      })
    ).toMatch(/^req_/);
  });

  test("requestPathFromUrl strips query and hash", () => {
    expect(requestPathFromUrl("/e?token=secret")).toBe("/e");
    expect(requestPathFromUrl("https://example.test/a?q=1#h")).toBe("/a");
    expect(requestPathFromUrl("http://[?x=1#y")).toBe("http://[");
    expect(requestPathFromUrl("http://[#frag")).toBe("http://[");
    expect(requestPathFromUrl("")).toBeUndefined();
  });

  test("withHttpContext and ambient logger", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    bindHttpLogger(logger);
    await withHttpContext({ method: "GET", path: "/z", requestId: "r1" }, () => {
      expect(getContext()?.requestId).toBe("r1");
      httpLogger().info("ok");
    });
    expect(sink.entries[0]!.record.context).toMatchObject({ requestId: "r1" });
  });

  test("headersAllowlist copies named headers into context", async () => {
    await withHttpContext(
      {
        method: "GET",
        path: "/h",
        headers: {
          "x-correlation-id": "corr-1",
          authorization: "secret",
        },
      },
      () => {
        expect(getContext()).toMatchObject({
          "x-correlation-id": "corr-1",
          path: "/h",
        });
        expect(getContext()?.authorization).toBeUndefined();
      },
      { headersAllowlist: ["x-correlation-id"] }
    );
  });

  test("logRequestCompletion uses error level for 5xx", () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    logRequestCompletion(logger, {
      method: "GET",
      path: "/x",
      status: 200,
      elapsedMs: 12.5,
    });
    logRequestCompletion(logger, {
      method: "POST",
      path: "/y",
      status: 500,
      elapsedMs: 3,
      error: new Error("fail"),
    });
    expect(parseLine(sink.entries[0]!.line)).toMatchObject({
      severity: "INFO",
      event: "http_request",
      status: 200,
      method: "GET",
      path: "/x",
      elapsedMs: 12.5,
    });
    const failed = parseLine(sink.entries[1]!.line);
    expect(failed.severity).toBe("ERROR");
    expect(failed.status).toBe(500);
    expect((failed.error as { message: string }).message).toBe("fail");
  });

  test("httpLogger accepts explicit logger and array headers", async () => {
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    expect(httpLogger({ logger })).toBe(logger);
    await withHttpContext(
      {
        method: "GET",
        path: "/arr",
        headers: { "x-request-id": ["arr-id", "other"] },
      },
      () => {
        expect(getContext()?.requestId).toBe("arr-id");
      }
    );
  });
});
