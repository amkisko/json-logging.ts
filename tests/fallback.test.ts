import { describe, expect, test } from "bun:test";
import { Logger } from "../src/logger.js";
import type { LogRecord, Sink } from "../src/types.js";
import { capturingSink, fixedClock, parseLine } from "./helpers.js";

describe("never-throw log path", () => {
  test("emits logger_error when record build fails", () => {
    const sink = capturingSink();
    let calls = 0;
    const logger = new Logger({
      sink,
      clock: () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("clock-boom");
        }
        return fixedClock();
      },
    });
    logger.info("still works");
    expect(sink.entries).toHaveLength(1);
    const last = parseLine(sink.entries[0]!.line);
    expect(last.severity).toBe("INFO");
    expect(last.message).toBe("still works");
    expect(last.logger_error).toEqual({
      name: "Error",
      message: "clock-boom",
    });
  });

  test("swallows secondary failure when sink also throws", () => {
    const sink: Sink = {
      write() {
        throw new Error("sink down");
      },
    };
    const logger = new Logger({
      sink,
      clock: fixedClock,
    });
    expect(() => logger.info("x")).not.toThrow();
  });

  test("swallows when fallback also fails", () => {
    const sink: Sink = {
      write() {
        throw new Error("sink down");
      },
    };
    const logger = new Logger({
      sink,
      clock: () => {
        throw new Error("always");
      },
    });
    expect(() => logger.info("x")).not.toThrow();
  });

  test("custom sink receives record", () => {
    const seen: LogRecord[] = [];
    const sink: Sink = {
      write(_line, record) {
        seen.push(record);
      },
    };
    new Logger({ sink, clock: fixedClock }).info("hi");
    expect(seen[0]!.message).toBe("hi");
  });
});
