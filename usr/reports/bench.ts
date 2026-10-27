/**
 * RFC-0002 hot-path benchmarks. Timing only; size stays in usr/budgets/bundle.json.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { withContext } from "../../src/context.js";
import { createLogger } from "../../src/json-logging.js";
import type { Sink } from "../../src/types.js";

type ScenarioBudget = {
  name: string;
  ceiling_ns: number;
  iterations: number;
};

type BenchBudget = {
  warm_up: number;
  runner_class: string;
  scenarios: ScenarioBudget[];
};

const noopSink: Sink = {
  write(): void {
    // discard
  },
};

function median(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function measureNs(
  iterations: number,
  warmUp: number,
  fn: () => void,
  wrap?: (body: () => void) => void
): number {
  const run = (body: () => void): void => {
    if (wrap) {
      wrap(body);
      return;
    }
    body();
  };
  for (let i = 0; i < warmUp; i += 1) {
    run(fn);
  }
  const samples: number[] = [];
  const batches = 21;
  const perBatch = Math.max(1, Math.floor(iterations / batches));
  for (let b = 0; b < batches; b += 1) {
    let elapsed = 0;
    run(() => {
      const start = Bun.nanoseconds();
      for (let i = 0; i < perBatch; i += 1) {
        fn();
      }
      elapsed = Bun.nanoseconds() - start;
    });
    samples.push(elapsed / perBatch);
  }
  return median(samples);
}

function buildRunners(): Record<string, () => void> {
  const disabled = createLogger({ sink: noopSink, level: "info" });
  const stringLogger = createLogger({ sink: noopSink, level: "info" });
  const objectLogger = createLogger({ sink: noopSink, level: "info" });
  const errorLogger = createLogger({ sink: noopSink, level: "info" });
  const contextLogger = createLogger({ sink: noopSink, level: "info" });
  const redactLogger = createLogger({
    sink: noopSink,
    level: "info",
    redact: ["user.password"],
  });
  const stickyBase: Record<string, unknown> = { service: "api" };
  for (let i = 0; i < 20; i += 1) {
    stickyBase[`k${i}`] = `v${i}`;
  }
  const stickyBaseLogger = createLogger({
    sink: noopSink,
    level: "info",
    base: stickyBase,
  });
  const providerLogger = createLogger({
    sink: noopSink,
    level: "info",
    contextProvider: () => undefined,
  });
  const err = new Error("e");

  return {
    "disabled-debug": () => {
      disabled.debug("x");
    },
    "string-info": () => {
      stringLogger.info("hello");
    },
    "object-info": () => {
      objectLogger.info({ event: "a", n: 1 });
    },
    "error-info": () => {
      errorLogger.info(err);
    },
    "with-context": () => {
      contextLogger.info("x");
    },
    "redact-path": () => {
      redactLogger.info({ user: { password: "secret", id: 1 }, event: "a" });
    },
    "sticky-base-info": () => {
      stickyBaseLogger.info("x");
    },
    "context-provider": () => {
      providerLogger.info("x");
    },
  };
}

function run(): number {
  const budgetPath = resolve(import.meta.dir, "../budgets/bench.json");
  const budget = JSON.parse(readFileSync(budgetPath, "utf8")) as BenchBudget;
  const warmUp = budget.warm_up;
  const started = new Date().toISOString();
  let status = 0;
  const runners = buildRunners();

  console.log(`bench: start=${started} runner=${budget.runner_class} warm_up=${warmUp}`);

  for (const scenario of budget.scenarios) {
    const fn = runners[scenario.name];
    if (!fn) {
      console.error(`bench fail: unknown scenario ${scenario.name}`);
      status = 1;
      continue;
    }
    const wrap =
      scenario.name === "with-context"
        ? (body: () => void) => {
            withContext({ requestId: "r" }, body);
          }
        : undefined;
    const medianNs = measureNs(scenario.iterations, warmUp, fn, wrap);
    const rounded = Math.round(medianNs);
    console.log(
      `bench: scenario=${scenario.name} median_ns=${rounded} ceiling_ns=${scenario.ceiling_ns} iterations=${scenario.iterations}`
    );
    if (rounded > scenario.ceiling_ns) {
      console.error(
        `bench fail: ${scenario.name} median_ns=${rounded} exceeds ceiling_ns=${scenario.ceiling_ns}`
      );
      status = 1;
    }
  }

  console.log(`bench: finish=${new Date().toISOString()} status=${status}`);
  return status;
}

process.exit(run());
