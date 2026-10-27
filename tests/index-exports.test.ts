import { describe, expect, test } from "bun:test";
import { installConsoleBridge, uninstallConsoleBridge } from "../src/console.js";
import {
  applyRedactPaths,
  captureConsoleMethods,
  consoleSink,
  consoleSinkFrom,
  createLogger,
  getContext,
  JsonLogging,
  LEVEL_ORDER,
  streamSink,
  withContext,
} from "../src/index.js";
import { capturingSink, fixedClock } from "./helpers.js";

describe("public index exports", () => {
  test("re-exports factory helpers and sinks", () => {
    expect(LEVEL_ORDER.info).toBe(1);
    expect(applyRedactPaths({ a: { b: 1 } }, ["a.b"])).toEqual({
      a: { b: "[FILTERED]" },
    });
    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    expect(JsonLogging.new({ sink, clock: fixedClock })).toBeInstanceOf(logger.constructor);
    expect(consoleSink()).toBeTruthy();
    expect(consoleSinkFrom(captureConsoleMethods())).toBeTruthy();
    expect(streamSink(new WritableStream())).toBeTruthy();
    expect(typeof installConsoleBridge).toBe("function");
    expect(typeof uninstallConsoleBridge).toBe("function");
    withContext({ k: 1 }, () => {
      expect(getContext()?.k).toBe(1);
      logger.info("from-index");
    });
    expect(sink.entries).toHaveLength(1);
  });
});
