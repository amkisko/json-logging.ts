import { afterEach, describe, expect, test } from "bun:test";
import {
  middleware,
  registerStructuredLogging,
  resetNextExampleForTests,
} from "../examples/next-instrumentation.js";
import {
  bootRemixLogging,
  handleRequest,
  resetRemixExampleForTests,
} from "../examples/remix-handle-request.js";
import { isConsoleBridgeInstalled, uninstallConsoleBridge } from "../src/console.js";
import { resetHttpLoggerForTests } from "../src/http.js";

afterEach(() => {
  uninstallConsoleBridge();
  resetHttpLoggerForTests();
  resetNextExampleForTests();
  resetRemixExampleForTests();
});

describe("example patterns", () => {
  test("next instrumentation boots bridge and middleware logs", async () => {
    const logger = registerStructuredLogging();
    expect(isConsoleBridgeInstalled()).toBe(true);
    const again = registerStructuredLogging();
    expect(again).toBe(logger);

    const result = await middleware({
      method: "GET",
      url: "https://example.test/x",
      headers: new Headers(),
      nextUrl: { pathname: "/x" },
    });
    expect(result).toEqual({ ok: true, method: "GET" });
  });

  test("remix handleRequest boots and returns response", async () => {
    bootRemixLogging();
    expect(isConsoleBridgeInstalled()).toBe(true);
    const response = await handleRequest(new Request("https://example.test/", { method: "GET" }), {
      requestId: "ex-1",
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("ok");
  });
});
