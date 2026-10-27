import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { consoleSink, streamSink } from "../src/sinks.js";
import type { LogRecord } from "../src/types.js";

const original = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

afterEach(() => {
  console.error = original.error;
  console.warn = original.warn;
  console.info = original.info;
  console.debug = original.debug;
});

describe("consoleSink", () => {
  test("routes by severity", () => {
    const calls: Array<{ method: string; arg: string }> = [];
    console.error = ((msg: string) =>
      calls.push({ method: "error", arg: msg })) as typeof console.error;
    console.warn = ((msg: string) =>
      calls.push({ method: "warn", arg: msg })) as typeof console.warn;
    console.info = ((msg: string) =>
      calls.push({ method: "info", arg: msg })) as typeof console.info;
    console.debug = ((msg: string) =>
      calls.push({ method: "debug", arg: msg })) as typeof console.debug;

    const sink = consoleSink();
    sink.write('{"a":1}\n', { severity: "ERROR" });
    sink.write('{"a":1}\n', { severity: "FATAL" });
    sink.write('{"a":1}\n', { severity: "WARN" });
    sink.write('{"a":1}\n', { severity: "DEBUG" });
    sink.write('{"a":1}\n', { severity: "INFO" });
    sink.write('{"a":1}\n', { severity: 1 as unknown as string });

    expect(calls.map((c) => c.method)).toEqual(["error", "error", "warn", "debug", "info", "info"]);
    expect(calls[0]!.arg).toBe('{"a":1}');
  });
});

describe("streamSink", () => {
  test("writes UTF-8 chunks with newline", async () => {
    const chunks: Uint8Array[] = [];
    const stream = new WritableStream<Uint8Array>({
      write(chunk) {
        chunks.push(chunk);
      },
    });
    const sink = streamSink(stream);
    await sink.write('{"ok":true}', { severity: "INFO" } as LogRecord);
    await sink.write('{"ok":false}\n', { severity: "INFO" } as LogRecord);
    const decoder = new TextDecoder();
    expect(decoder.decode(chunks[0]!)).toBe('{"ok":true}\n');
    expect(decoder.decode(chunks[1]!)).toBe('{"ok":false}\n');
  });

  test("swallows write failures", async () => {
    const stream = new WritableStream<Uint8Array>({
      write() {
        throw new Error("closed");
      },
    });
    const sink = streamSink(stream, { encoding: "utf-8" });
    await expect(sink.write("x\n", { severity: "INFO" })).resolves.toBeUndefined();
  });
});

describe("consoleSink spy path", () => {
  test("uses spyOn compatible binding", () => {
    const info = spyOn(console, "info").mockImplementation(() => {});
    consoleSink().write("line\n", { severity: "INFO" });
    expect(info).toHaveBeenCalled();
    info.mockRestore();
  });
});
