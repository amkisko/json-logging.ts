import { beforeEach, describe, expect, test } from "bun:test";
import { createRequestHandler, type ServerBuild } from "@remix-run/node";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { httpLogger, resetHttpLoggerForTests } from "../../src/http.js";
import { withRemixContext } from "../../src/remix.js";
import { contextFromLines, e2eLogger } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

function minimalBuild(): ServerBuild {
  return {
    mode: "production",
    publicPath: "/",
    assetsBuildDirectory: "build",
    isSpaMode: false,
    future: {
      v3_fetcherPersist: false,
      v3_relativeSplatPath: false,
      v3_throwAbortReason: false,
      v3_singleFetch: false,
      v3_lazyRouteDiscovery: false,
    },
    entry: {
      module: {
        default: async () => new Response("document"),
      },
    },
    routes: {
      root: {
        id: "root",
        path: "",
        module: {
          loader: async () => {
            await Promise.resolve();
            httpLogger().info({ event: "remix-loader" });
            return { ok: true };
          },
        },
      },
    },
    assets: {
      entry: { imports: [], module: "" },
      routes: {
        root: {
          id: "root",
          path: "",
          hasAction: false,
          hasLoader: true,
          hasClientAction: false,
          hasClientLoader: false,
          hasErrorBoundary: false,
          module: "",
        },
      },
      url: "/manifest",
      version: "1",
    },
  };
}

describe("e2e remix createRequestHandler", () => {
  test("real createRequestHandler loader keeps ALS via withRemixContext", async () => {
    const { sink, logger } = e2eLogger();
    const remixHandler = createRequestHandler(minimalBuild(), "production");

    const handle = (request: Request, loadContext: Record<string, unknown> = {}) =>
      withRemixContext(
        { request, context: loadContext },
        () => remixHandler(request, loadContext),
        { logger, contextKeys: ["userId"] }
      );

    const response = await handle(
      new Request("https://example.test/?_data=root", {
        method: "GET",
        headers: { "x-request-id": "remix-fw-1" },
      }),
      { requestId: "remix-fw-1", userId: "u9", secret: "nope" }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true });

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "remix-fw-1",
      method: "GET",
      path: "/",
      userId: "u9",
    });
    expect(contextFromLines(sink.entries)?.secret).toBeUndefined();
    expect(sink.entries.some((entry) => entry.record.event === "remix-loader")).toBe(true);
  });
});
