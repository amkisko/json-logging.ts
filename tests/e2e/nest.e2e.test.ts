import "reflect-metadata";
import { beforeEach, describe, expect, test } from "bun:test";
import type { createServer } from "node:http";
import {
  type CallHandler,
  Controller,
  type ExecutionContext,
  Get,
  Module,
  type NestInterceptor,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { lastValueFrom, Observable } from "rxjs";
import { resetContextStorageForTests, setAlsOverrideForTests } from "../../src/context.js";
import { withExpressLogging } from "../../src/express.js";
import {
  bindHttpLogger,
  httpLogger,
  resetHttpLoggerForTests,
  withHttpContext,
} from "../../src/http.js";
import { parseLine } from "../helpers.js";
import { contextFromLines, e2eLogger, listenHttp } from "./helpers.js";

beforeEach(() => {
  setAlsOverrideForTests(undefined);
  resetContextStorageForTests();
  resetHttpLoggerForTests();
});

@Controller()
class ItemsController {
  @Get("items")
  async items(): Promise<string> {
    await Promise.resolve();
    httpLogger().info({ event: "handler" });
    return "ok";
  }
}

@Module({ controllers: [ItemsController] })
class AppModule {}

class NestFastifyContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();
    return new Observable((subscriber) => {
      void withHttpContext(
        {
          method: req.method,
          url: req.url,
          headers: req.headers,
        },
        async () => {
          try {
            const value = await lastValueFrom(next.handle());
            subscriber.next(value);
            subscriber.complete();
          } catch (error) {
            subscriber.error(error);
          }
        }
      );
    });
  }
}

describe("e2e nest composition", () => {
  test("Nest Express platform uses withExpressLogging", async () => {
    const { sink, logger } = e2eLogger();
    const app = await NestFactory.create(AppModule, { logger: false });
    app.use(withExpressLogging({ logger, logCompletion: true }));
    await app.init();

    const server = app.getHttpServer() as ReturnType<typeof createServer>;
    const { baseUrl, close } = await listenHttp(server);
    try {
      const response = await fetch(`${baseUrl}/items`, {
        headers: { "x-request-id": "nest-express-1" },
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("ok");
    } finally {
      await close();
      await app.close();
    }

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "nest-express-1",
      method: "GET",
      path: "/items",
    });
    const completion = sink.entries.find((entry) => entry.record.event === "http_request");
    expect(completion).toBeDefined();
    expect(parseLine(completion!.line)).toMatchObject({
      event: "http_request",
      status: 200,
      path: "/items",
    });
  });

  test("Nest Fastify platform uses withHttpContext interceptor", async () => {
    const { sink, logger } = e2eLogger();
    bindHttpLogger(logger);

    const app = await NestFactory.create(AppModule, new FastifyAdapter(), { logger: false });
    app.useGlobalInterceptors(new NestFastifyContextInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({
      method: "GET",
      url: "/items",
      headers: { "x-request-id": "nest-fastify-1" },
    });
    if (response.statusCode !== 200) {
      throw new Error(`nest fastify status ${response.statusCode}: ${response.body}`);
    }
    expect(response.body).toBe("ok");
    await app.close();

    expect(contextFromLines(sink.entries)).toMatchObject({
      requestId: "nest-fastify-1",
      method: "GET",
      path: "/items",
    });
    expect(sink.entries.some((entry) => entry.record.event === "handler")).toBe(true);
  });
});
