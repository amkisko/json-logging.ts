import type { AddressInfo, Server } from "node:http";
import { createLogger } from "../../src/json-logging.js";
import { capturingSink, fixedClock } from "../helpers.js";

export function e2eLogger() {
  const sink = capturingSink();
  const logger = createLogger({ sink, clock: fixedClock });
  return { sink, logger };
}

export async function listenHttp(
  server: Server
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function contextFromLines(
  entries: ReadonlyArray<{ record: Record<string, unknown> }>
): Record<string, unknown> | undefined {
  for (const entry of entries) {
    const context = entry.record.context;
    if (context && typeof context === "object") {
      return context as Record<string, unknown>;
    }
  }
  return undefined;
}
