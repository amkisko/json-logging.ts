# Ruby gem parity brief: activesupport-json_logging

Research digest for the TypeScript port. Labels: Fact vs Inference. Source tree is the sibling activesupport-json_logging.rb checkout.

## Decisions

- Mirror portable API: JsonLogging.new, with_context, tagged (block and sticky child), message kinds (string, object, Error), never-raise format path, single-line JSON.
- Keep Rails EventSubscriber and Railtie out of the TypeScript core. Inference: optional later adapters, not MVP.
- Map IsolatedExecutionState / Thread storage to AsyncLocalStorage.run. Inference.

## Effects

### Public API (Fact)

- JsonLogging.new(logger): wrap and force JSON formatter.
- JsonLogging.logger(...): create ActiveSupport::Logger then wrap.
- JsonLogging.with_context(extra): block-scoped merge into fiber/thread context.
- JsonLogging.additional_context / transformer: process-wide context transform.
- On wrapped loggers: tagged, severity methods, flush clears tags.

### JSON line shape (Fact)

Root fields: message (string) or merged object fields; severity (DEBUG..UNKNOWN string); timestamp (UTC ISO8601 with microseconds); optional tags (string array); optional context (object). System keys tags, severity, timestamp, message, context are not re-injected into nested context. Exception becomes error: { class, message, backtrace }. Encode failure emits formatter_error or logger_error and still writes a line.

### Safety limits (Fact)

MAX_STRING_LENGTH 10000; MAX_CONTEXT_SIZE 50; MAX_DEPTH 10; backtrace max 20 lines; sensitive key filtering; control chars stripped; home path redacted to ~.

### LOC model (Fact / Inference)

Ruby lib ~1711 LOC. Larger modules (sanitizer, line_encoder) sit near 237-250. TypeScript should keep modules in 150-300 LOC; fold tiny helpers rather than 1:1 splintering of every 40-LOC Ruby file.

### Minimum config mapping (Inference)

Rails: install gem + config.logger = JsonLogging.new(Logger.new(STDOUT)). TypeScript: createLogger() or JsonLogging.new() to console JSON; optional withContext at request boundary; ./next and ./remix helpers for one-line wrap.

## Next

- Implement core per docs/plans/20261026072501_api-design-sketch.md.
- Measure coverage with bun test --coverage and type-coverage --at-least 100.

## Source

- Sibling repository activesupport-json_logging.rb lib/ and README
- Research subagent digest from this session
