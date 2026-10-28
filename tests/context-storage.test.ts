import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AsyncLocalStorage } from "node:async_hooks";
import {
  type ContextStore,
  configureContextStorage,
  getContext,
  isAsyncLocalStorageAvailable,
  resetContextStorageForTests,
  setAlsConstructorForTests,
  setAlsOverrideForTests,
  withContext,
} from "../src/context.js";
import { createLogger } from "../src/json-logging.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

function resetAlsHooks(): void {
  configureContextStorage(null);
  setAlsConstructorForTests(undefined);
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
}

beforeEach(resetAlsHooks);
afterEach(resetAlsHooks);

describe("configureContextStorage", () => {
  test("injected ALS retains withContext when soft-load is disabled", () => {
    setAlsConstructorForTests(null);
    expect(isAsyncLocalStorageAvailable()).toBe(false);

    const storage = new AsyncLocalStorage<ContextStore>();
    configureContextStorage(storage);
    expect(isAsyncLocalStorageAvailable()).toBe(true);

    const sink = capturingSink();
    const logger = createLogger({ sink, clock: fixedClock });
    withContext({ requestId: "worker-1" }, () => {
      expect(getContext()).toEqual({ requestId: "worker-1" });
      logger.info("ok");
    });
    expect(parseLine(sink.entries[0]!.line).context).toEqual({ requestId: "worker-1" });
  });

  test("null clears injection and restores soft-load", () => {
    setAlsConstructorForTests(null);
    configureContextStorage(new AsyncLocalStorage<ContextStore>());
    expect(isAsyncLocalStorageAvailable()).toBe(true);
    configureContextStorage(null);
    expect(isAsyncLocalStorageAvailable()).toBe(false);
  });

  test("test override null reports ALS unavailable", () => {
    setAlsOverrideForTests(null);
    expect(isAsyncLocalStorageAvailable()).toBe(false);
  });
});
