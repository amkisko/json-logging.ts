# Cross-language JSON logging survey

Design research: which languages and frameworks support or lack structured JSON logging, how it is usually done, and what `@amkisko/json-logging` should take or improve. Claims are labeled Fact or Inference. Merged from multi-model agent passes on 2026-10-26; git history is the edit log.

## Decisions

- Treat JSON-by-default as rare in language stdlibs and most frameworks. Fact: Go slog ships JSONHandler but default is not JSON until configured. Fact: Python logging is text-oriented by default. Fact: Spring Boot 3.4 structured formats require `logging.structured.format.*`. Fact: AWS Lambda classic default log format is plain text until JSON is opted in.
- Prefer patterns that match this package: one JSON object per line, request context, tags, never-raise encode path, zero runtime deps, Edge-safe sinks.
- Keep OpenTelemetry out of the core package. Fact: OTel Logs Bridge API is for library appenders, not app calls. Inference: optional `contextProvider` or peer subpath can inject `trace_id` / `span_id` without importing `@opentelemetry/*` in core.
- Record gaps separately from mature JSON ecosystems so product positioning stays honest.

## Effects

### How JSON logging is usually done

Four recurring shapes (Inference; Fact examples named):

1. Stdlib structured logger with pluggable handlers: Go `log/slog` JSONHandler; Java SLF4J + Logback/Log4j2 encoder; Elixir `:logger` formatter swap; Crystal `Log` + `require "log/json"`.
2. Third-party JSON-first logger: Node Pino/Winston; Python structlog/loguru; .NET Serilog; PHP Monolog JsonFormatter; Ruby Semantic Logger / activesupport-json_logging; Rust tracing-subscriber json.
3. Framework access/request logging as a separate pipeline: Rails Lograge; ASP.NET HttpLogging; FastAPI/Uvicorn access lines; Gin/Echo/Chi middleware; often text until customized.
4. Platform or agent rewrite: Cloud agents parse text; OpenTelemetry Collector filelog transforms. Inference: emit JSON at the app when possible.

Common API ideas (Inference; Fact examples in parentheses):

- Bind/child loggers with frozen fields (structlog bind; slog With; Pino child; Serilog ForContext; swift-log value Logger).
- Scoped context (ActiveSupport tags/with_context; SLF4J MDC; Laravel Context; ALS; BEAM process dictionary; Crystal fiber context; Swift TaskLocal / MetadataProvider).
- Processor pipelines (structlog processors; Serilog enrichers; Logback providers; LoggerJSON redactors).
- Canonical one-line-per-request (structlog best practices; SerilogRequestLogging; Lograge).
- Dev pretty vs prod JSON (structlog ConsoleRenderer vs JSONRenderer; Quarkus `%dev` text / prod JSON extension).
- Precompile config at logger construction (LoggerJSON 7 Formatter.new; Zig log.zig buffer pools; this package compileRedactPaths).

### Inventory by language

JSON levels: yes = first-class easy JSON lines; partial = needs config or extra package; no = text default; weak = mobile/browser or host-managed only.

Ruby

- stdlib Logger: no. Fact: default formatter is text; custom formatter receives severity/time/progname/msg.
- ActiveSupport::TaggedLogging: partial. Fact: tags as text prefixes via IsolatedExecutionState; not JSON fields.
- activesupport-json_logging: yes. Fact: JsonLogging.new, tagged, with_context, JSON lines (sibling gem; this package ports the idea).
- Semantic Logger: yes / partial. Fact: formatter: :json; tagged; concurrent-ruby dependency; async appenders.
- Lograge: partial. Fact: one request line; Json formatter optional; other Rails.logger calls unchanged.
- Rails production default: no. Fact: TaggedLogging + text; Rails 8.1 Rails.event is structured events, not a drop-in JSON logger swap.

JavaScript / TypeScript

- console: no. Fact: util.format / inspect; JSON needs stringify or object-to-platform.
- Pino: yes. Fact: JSON by default; child; destinations/transports; mixin for ALS; heavy runtime deps; Workers support untested.
- Winston: yes / partial. Fact: JSON format common; transports; Edge/browser breakages reported.
- Bunyan: yes on Node. Fact: child/streams; browser prints raw objects.
- LogTape: yes / partial. Fact: zero-dep; jsonLinesFormatter; with/withContext; Edge docs; category/configure surface.
- Roarr: yes / partial. Fact: JSON records; child/adopt; ROARR_LOG gate; adopt uses Node ALS.
- Fastify: yes when logger enabled. Fact: Pino child per request; off by default until logger: true.
- Next.js: no. Fact: logging config is mostly dev; production needs instrumentation + own logger.
- Remix: no. Fact: console errors; getLoadContext for explicit injection.
- Hono: no. Fact: built-in logger middleware is text/colored; c.set/c.var for state.
- Express: no. Fact: Morgan text by default; object-mode stream optional.
- NestJS: partial. Fact: ConsoleLogger({ json: true }); component context; ALS is a recipe.
- Deno: partial. Fact: console not JSON; OTel and @std/log can produce structured export.
- Cloudflare Workers: partial. Fact: console.log(object) fields indexed; ALS subset (run/getStore; no enterWith/disable).

Python

- logging stdlib: no. Fact: text formatters; cookbook shows contextvars / LoggerAdapter.
- structlog: yes when JSONRenderer configured. Fact: bind; contextvars helpers; sync/async isolation caveat on Starlette.
- loguru: partial. Fact: serialize=True; bind/contextualize; global singleton.
- python-json-logger: partial. Fact: Formatter for logging; no own context machine.
- uvicorn: no / partial. Fact: text access format; dictConfig can swap formatters.
- Django / Flask: no. Fact: dictConfig; no built-in JSON formatter in Django DEFAULT_LOGGING.
- FastAPI: Inference: no own logger; middleware + structlog/contextvars is the common pattern.

Go

- log classic: no.
- log/slog: yes when NewJSONHandler used. Fact: With/WithGroup; Context methods; Enabled/LogAttrs.
- zap: yes (production JSON encoder). Fact: With fields; high-throughput claims.
- zerolog: yes. Fact: chained With; logger in context; Ctx hooks.
- logrus: partial. Fact: JSONFormatter opt-in; maintenance mode; README points to slog.
- charmbracelet/log: partial. Fact: text default; JSONFormatter available.
- chi / echo / gin middleware: partial. Fact: text or string formatters by default; request fields customizable; no automatic app-wide request id bind.

JVM (Java / Kotlin)

- Logback pattern: no. Fact: JSON via logstash-logback-encoder (Jackson) or contrib layouts.
- Log4j2 JsonTemplateLayout: yes inside that layout. Fact: separate artifact; ECS template default for that layout; pretty-print unsupported.
- SLF4J MDC: context only. Fact: thread map; backends may ignore; child-thread inheritance contested in docs.
- Spring Boot: no until property. Fact: 3.4 ecs/gelf/logstash via logging.structured.format.*; MDC and addKeyValue copied.
- Micronaut: no in core guide. Fact: colored Logback sample; JSON in cloud integration guides.
- Quarkus: no until quarkus-logging-json. Fact: replaces console format; ecs/gcp/default; MDC nested unless flattened; async off by default.
- Kotlin server: partial. Fact: kotlin-logging over SLF4J; MDCContext required for coroutines.
- Android Timber / Log: weak. Fact: unstructured Logcat; third-party JSON trees exist.

.NET

- Microsoft.Extensions.Logging: partial. Fact: structured templates; Simple console default; AddJsonConsole opt-in; BeginScope.
- Serilog: yes for event model; sinks often text unless CompactJsonFormatter. Fact: LogContext AsyncLocal; UseSerilogRequestLogging one completion line; async sink drops when full unless blockWhenFull.
- NLog JsonLayout: partial. Fact: opt-in; IncludeEventProperties/IncludeScopeProperties default false; ScopeContext AsyncLocal.
- ASP.NET HttpLogging: partial. Fact: header allowlist/redaction; CombineLogs false; body caps; format follows provider.

Elixir / Erlang

- Logger / :logger: no default JSON. Fact: structured event maps; process-dictionary metadata.
- logger_json: yes. Fact: Basic/GoogleCloud/Datadog/Elastic; Formatter.new precompiles; redactors; Plug/Ecto telemetry helpers.

PHP

- native error_log: no.
- Monolog JsonFormatter: yes. Fact: LogRecord context vs extra; batch newlines; schema formatters.
- Laravel: partial. Fact: Log::withContext; Context facade (Laravel 11+) dehydrates into queued jobs; cloud often stderr JSON via Monolog.

Rust

- log + env_logger: no / partial. Fact: kv feature on log; env_logger is text; JSON needs third-party.
- tracing + tracing-subscriber: yes with json feature. Fact: fields/span/spans; flatten_event; Instrument for async.

Swift / Apple

- OSLog: weak. Fact: binary unified logging; JSON via tools, not NDJSON to containers.
- swift-log: partial. Fact: MetadataValue; MetadataProvider; task-local Logger (SLG-0006); JSON via community LogHandler.

Crystal

- Log stdlib: partial. Fact: fiber-local Log.context; require "log/json" for JSON builders.

Zig

- std.log: no. Fact: printf-style, no structured fields.
- karlseguin/log.zig / softprops/zig-jsonlog: yes / partial. Fact: community JSON/logfmt with pooled buffers.

Julia

- Logging stdlib: no. Fact: `@info msg key=value`; task-local `with_logger`, global fallback; child tasks inherit logger; `min_enabled_level` / `shouldlog` run before message work; `catch_exceptions` default; `exception=(ex,bt)` and `maxlog=` are reserved kwargs. ConsoleLogger renders kwargs as indented text.
- LoggingExtras.jl: no ready JSON. Fact: Tee/filters/TransformerLogger/FormatLogger; README points JSON at FormatLogger; shared fields via TransformerLogger.
- LoggingFormats.jl: partial. Fact: `FormatLogger(LoggingFormats.JSON(), stderr)` one object per line (`level`, `msg`, `module`, `file`, `line`, `group`, `id`, `kwargs`); `recursive=true` with string fallback; sample output has no timestamp; user fields nested under `kwargs`.
- TerminalLoggers.jl: no. Fact: richer REPL formatting only.
- LoggingFacilities.jl: partial. Fact: `JSONTransformerLogger` can flatten (`message`, `level`, kwargs) into MessageOnlyLogger. Inference: verify maintenance before product claims.
- Inference: strong structured kwargs in macros; JSON is extras, not REPL default. Parallel to this package: kwargs as call-site fields + `with_logger` as scoped sink swap.

R

- logger (daroczig): partial. Fact: `log_layout(layout_json())` / `formatter_json` + `layout_json_parser()`; jsonlite in Suggests; default fields include host/user/os/pid; namespace and `with_log_threshold`; no first-class key bag.
- futile.logger: no. Fact: text layouts only; appender receives one string.
- lgr: partial. Fact: LogEvent with arbitrary fields; LayoutJson / AppenderJson jsonlines; `with_log_value` / FilterInject; transform/exclude/timestamp hooks; example level is numeric (400); timestamp often without zone.
- Inference: both JSON paths lean on `jsonlite::toJSON(auto_unbox = TRUE)`.

Clojure

- tools.logging: no. Fact: facade only; JSON belongs to the selected JVM backend.
- Timbre: partial. Fact: default println appender is text; `with-context` adds a context map to event data; JSON needs a separate output-fn/appender (e.g. timbre-json-appender); author points new work at Telemere.
- pedestal.log: no. Fact: SLF4J adapter; `with-context` formats one map into MDC under `io.pedestal` by default; docs warn thread-local MDC can retain stale context on reused threads.
- mulog: yes for events when a JSON publisher is started. Fact: native model is event maps; global context and `with-context`; file-json / console-json are one object per line; async publish prefers drop over crash.
- Cambium / Logback JSON: partial. Fact: structured SLF4J plus `cambium.logback.json` or current Logback `JsonEncoder` / logstash-logback-encoder; concurrent work needs explicit context propagation.
- puppetlabs/structured-logging: partial. Fact: `maplog` + Logback LoggingEventCompositeJsonEncoder; Logback-only.

Scala

- SLF4J / Logback: no until encoder. Fact: built-in `JsonEncoder` and logstash-logback-encoder are opt-in; MDC string map is per-thread and not inherited by child threads in current Logback adapter.
- log4cats: no. Fact: effectful algebras; `StructuredLogger.withContext` is `Map[String, String]`; rendering delegated to SLF4J or another backend.
- zio-logging: partial. Fact: text `LogFormat.default`; explicit `consoleJsonLogger` / `consoleErrJsonLogger`; FiberRef logger context; annotations propagate with fiber semantics including parallel children.
- scribe: yes when scribe-json wired. Fact: default multi-line text; JsonWriter modules; MDC local/global/SLF4J; verify JSON schema consistency before treating as a contract (messages array vs single message discussed upstream).

Haskell

- hslogger: no. Fact: token text formatters; no structured context API.
- katip: yes when `jsonFormat` scribe used. Fact: default handle scribe is bracketed text; `KatipContext` carries typed payload and namespace; JSON retains typed payload values; verbosity controls how much structure is emitted.
- co-log: no in core. Fact: composable `LogAction`; context is message-type dependent.
- co-log-json: yes when used. Fact: separate niche extension; nested `addContext` scopes; JSON with `namespace`, `severity`, `thread`, `message`, `data`.
- monad-logger-json: weak. Fact: encodes ToJSON as the message through monad-logger; no scoped structured-context API; effectively frozen since 2015. Inference: do not model a new API on it.

OCaml / F#

- Logs / Logs_fmt (OCaml): no. Fact: reporters separate from sources; Logs_fmt is colored text; typed `Logs.Tag` per event; no general ambient async context in core.
- json-logs / Json_logs: yes when installed as reporter. Fact: one JSON line on stderr; tags become fields; base hostname/pid/app optional. Fact: tag values are rendered as JSON strings (type erasure). Inference: promising but not a safe opam default yet (overlay / visibility caveats).
- Dream: no. Fact: uses Logs; text to stderr; request id as Logs.Tag with best-effort Lwt local fallback; `~request` for explicit association. Inference: guess-the-request is not a core-library contract.
- F# MEL / Serilog: partial. Fact: same as .NET section; `BeginScope` on AsyncLocal; Serilog needs CompactJsonFormatter for NDJSON; Destructurama.FSharp for idiomatic F# records.

Kotlin Multiplatform (distinct from JVM server)

- Kermit: weak for JSON lines. Fact: platform writers (Logcat, OSLog, console); severity/message/tag; no first-class per-event structured attributes in core.
- Napier: weak. Fact: delegates to platform loggers; basic tags; no built-in JSON or scoped structured context.

Nim

- std/logging: no. Fact: `varargs[string, $]` text; thread-local handlers/filters must be set per thread; docs say write your own if needs grow.
- chronicles: partial. Fact: event name + properties; default `textlines` (logfmt-compatible); `-d:chronicles_sinks=json` or `json[file]`; compile-time sinks; `logScope` / `dynamicLogScope` for call-tree properties; `writeValue` overloads; can disable logging at compile time. Inference: compile-time sink selection does not map to this package's runtime Edge story.

Dart / Flutter

- dart:developer `log`: weak. Fact: DevTools Logging view; mirrors package:logging shape; not a container NDJSON sink.
- package:logging: no. Fact: must subscribe `Logger.root.onRecord`; LogRecord has message/error/name/stack; lazy message closures; no structured context API. Inference: Zone.zoneValues is the usual async bag if needed.
- package:logger: no. Fact: filter/printer/output; custom LogPrinter returns string lines; no bundled JSON printer or context.
- community (contextual, x_logger, hyper_logger, others): partial. Fact: JsonLogFormatter / JsonPrinter / env-based format exist on pub.dev; maturity varies; mobile/console remain common sinks.

Lua / OpenResty

- ngx.log: no. Fact: concatenates args into error.log; nil prints as `"nil"`; Nginx error message length cap (~2048) truncates; format hardcoded.
- access_log: partial. Fact: `log_format ... escape=json` since nginx 1.11.8; older OpenResty builds without that may lack it; `log_by_lua` can set `ngx.var` then cjson.encode; request state in `ngx.ctx` (documented as relatively expensive).
- lua-resty-logger-socket: no. Fact: buffers/sends a hand-built `msg` string; experimental; does not JSON-encode.
- lualogging: no. Fact: Log4j-style appenders; JSON support issue still open as of late 2024.
- Kong: partial. Fact: `kong.log` is text via error_log; `file-log` plugin emits JSON and `custom_fields_by_lua` can reshape.

Perl

- Log::Log4perl default: no.
- Log::Log4perl::Layout::JSON: partial. Fact: one-line JSON hash; PatternLayout field map; `include_mdc` / `name_for_mdc`; MDC wins name collisions; `maxkb` / `max_json_length_kb` (default 20 KB) drop/truncate to keep JSON valid under syslog cutoffs; `warp_message = 0` treats args as name/value; MDC is global/thread-local, not async-scoped.
- Log::Any: no until adapter. Fact: producer/consumer split; one trailing hashref for structure; `$log->context` with `local`; adapters without structure stringify via Data::Dumper.
- Log::Any::Adapter::JSON: yes when set. Fact: one JSON line; `time` UTC with `Z`, `level`, `category`, `message`; first hashref promoted; reserved keys; overflow to `hash_data` / `list_data` / `additional_messages`; `without_formatting` avoids sprintf crashes.
- Mojo::Log: no. Fact: `format` callback returns a string; `context('[abc]')` is a text prefix child logger, not fields. Inference: JSON needs a custom format (or a separate Mojo::Log::JSON distribution if used).

### Cloud and platform gaps

- AWS Lambda classic: Fact: plain text default; JSON via LoggingConfig; object vs stringified line behavior differs by product mode (smoke-test before README claims).
- Azure Functions Node: Fact: context.log uses util.format (objects become strings); wontfix on structured console.
- GCP Cloud Run: Fact: single-line JSON becomes jsonPayload; special fields severity, message, logging.googleapis.com/trace.
- Vercel: Fact: drains type message as string; platform adds level/requestId/traceId; line/request size caps.
- Cloudflare Workers: Fact: object console fields indexed; 256 KB per invocation; observability config.
- WordPress / WP_DEBUG_LOG: Fact: plain text debug.log.
- Browser console: Fact: local DevTools only; OTel does not auto-instrument host console.
- Mainframe / z/OS: Fact: JSON at forwarder/SMF tools, not COBOL DISPLAY. Inference: out of scope for this package.

### Patterns to take into `@amkisko/json-logging`

Already aligned (Fact from this repo):

- ActiveSupport tagged + withContext
- JSON lines to console / WritableStream
- Zero runtime deps; Edge-safe core; ALS run subset
- Path redact compiled once; serializers; isLevelEnabled; slim HTTP adapters
- Context under context key; tags array; system key protection

Worth adopting or deepening (Inference from agent passes):

1. Optional contextProvider / mixin at log time for OTel or baggage without core deps (Swift MetadataProvider; Elixir opentelemetry_logger_metadata).
2. Canonical request completion line (method, path, status, elapsed; query off; Error level on 5xx) on adapters (SerilogRequestLogging; Lograge).
3. Header allowlist for any access-style fields (ASP.NET HttpLogging); denylist alone is weaker.
4. Pre-sanitize base and sticky tags once at Logger construction (LoggerJSON 7; extend compileRedactPaths pattern).
5. Platform sink notes: Workers/Lambda may prefer console object; containers prefer stringified line (Cloud Run).
6. Document dehydrate/hydrate of getContext across Next middleware to Node and queue workers (Laravel Context).
7. Optional nestedKey / ECS field aliases as adapters only, not core schemas.
8. Dev pretty sink later; never default; never worker transport.
9. Overflow policy only if async sink is added later; stdout sync is enough for containers.
10. Keep kwargs/call-site fields first-class and distinct from ambient context (Julia `@info` kwargs under `kwargs`; mulog event maps; chronicles event properties; lgr custom fields; Katip typed payloads).
11. Prefer drop-or-skip over process crash on bad encode only when explicitly async; sync stdout should still never-raise with string fallback (mulog drop preference vs LoggingFormats string fallback).
12. Compile-time or construction-time sink format choice (chronicles sinks; LoggingFormats.JSON wired once) matches our compileRedactPaths discipline.
13. Keep three concepts distinct: explicit event fields, immutable child/base fields, ambient scoped context/tags (Timbre/Katip/log4cats/Serilog/ZIO).
14. Copy fiber/async scope semantics via ALS.run overlays (zio-logging FiberRef; .NET BeginScope), not thread-only MDC.
15. Preserve JSON value types; avoid string-only MDC and stringified tag reporters as the only path (Katip/mulog vs OCaml json-logs string tags).
16. Build the event before the sink so formatters cannot reread mutated ambient state (mulog publisher boundary; OCaml reporter boundary with one schema).
17. Early level check before building the message (Julia shouldlog; Dart lazy message closures); keep `isLevelEnabled` and optional lazy message forms.
18. Document reserved-key collision policy and overflow keys (Log::Any::Adapter::JSON reserved set; LoggingFormats nested `kwargs`; Log4perl MDC wins).
19. Optional per-field / total size caps that keep the line valid JSON after truncation (Log4perl maxkb / max_json_length_kb vs syslog cutoffs).
20. Prefer UTC timestamps with `Z` (Log::Any::Adapter::JSON); avoid host/user identity fields in defaults (R logger default_fields).
21. Keep exception in a dedicated structured field (`exception` / `error`), not only inside the message string (Julia exception kwargs; Dart error/stackTrace).

### Patterns to avoid

- Heavy transport/worker graphs as default (Pino transports; Disruptor as library default).
- Thread-only MDC without async story (Kotlin MDCContext tax; Logback inheritance confusion; Pedestal MDC reuse warning).
- Bundled ECS/GELF/Logstash template languages and Jackson in core.
- Facade matrices (SLF4J + multiple backends) as the product.
- Logging request/response bodies by default.
- Claiming JSON-by-default where host or framework still prints text.
- Importing OpenTelemetry SDK in core (Node version and package churn).
- Calling a JSON-encoded message payload "JSON logging" when the envelope stays text (monad-logger-json shape).
- Best-effort request discovery (Dream fallback); adapters must pass request context explicitly.
- Silent encode failure defaults (e.g. JSON appenders whose error hook is a no-op).
- Default fields that identify host or user without opt-in (R logger defaults).
- Compile-time-only sink graphs as the product story (chronicles); this package needs runtime Edge fallbacks.

### Improvements we can bring (product niche)

Inference relative to crowded Node space and cross-language gaps:

- ActiveSupport familiarity for Rails-to-TS teams
- Thin multi-framework HTTP adapters without framework packages as deps
- Sanitization caps and never-raise encode path as first-class
- Bench and bundle gates as published contracts
- Explicit Edge/Workers ALS subset and sink guidance
- Clear separation of call-site fields vs ambient context vs tags (Monolog context/extra; tracing fields/spans)

## Next

- Phase 1 shipped experimentally as RFC-0004: construction-time sanitize, contextProvider, logRequestCompletion, headersAllowlist, related benches.
- Claims-audit before any README asserts Lambda/Workers object-vs-string behavior; run smoke tests first.
- Optional follow-up: Cloud Run severity alias adapter; dehydrate/hydrate docs for isolate hops; Next/Remix logCompletion.
- Keep NGINX/PostgreSQL JSON toggles unverified until needed for product claims.
- No change to zero-dep policy from this survey alone.

## Source

- https://go.dev/blog/slog
- https://pkg.go.dev/log/slog
- https://structlog.org/en/stable/logging-best-practices.html
- https://docs.python.org/3/library/logging.html
- https://docs.python.org/3/howto/logging-cookbook.html
- https://spring.io/blog/2024/08/23/structured-logging-in-spring-boot-3-4
- https://docs.spring.io/spring-boot/reference/features/logging.html
- https://hex.pm/packages/logger_json
- https://logger-json.hexdocs.pm/LoggerJSON.html
- https://github.com/logfellow/logstash-logback-encoder
- https://quarkus.io/guides/logging
- https://learn.microsoft.com/en-us/dotnet/core/extensions/logging
- https://github.com/serilog/serilog
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/http-logging/
- https://docs.rs/tracing-subscriber/latest/tracing_subscriber/fmt/format/struct.Json.html
- https://laravel.com/docs/context
- https://github.com/apple/swift-log
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/
- https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs-logformat.html
- https://docs.cloud.google.com/run/docs/logging
- https://opentelemetry.io/docs/specs/otel/logs/
- https://opentelemetry.io/docs/specs/otel/compatibility/logging_trace_context/
- https://logtape.org/
- https://github.com/amkisko/activesupport-json_logging.rb
- https://docs.julialang.org/en/v1/stdlib/Logging/
- https://julialogging.github.io/package-overview/
- https://github.com/JuliaLogging/LoggingFormats.jl
- https://github.com/JuliaLogging/LoggingExtras.jl
- https://daroczig.github.io/logger/
- https://s-fleck.github.io/lgr/
- https://github.com/BrunoBonacci/mulog
- https://github.com/taoensso/timbre/
- https://github.com/puppetlabs/structured-logging
- https://github.com/clojure/tools.logging/
- https://cljdoc.org/d/io.pedestal/pedestal.log/0.8.2/api/io.pedestal.log
- https://typelevel.org/log4cats/
- https://zio.dev/zio-logging/
- https://github.com/outr/scribe/
- https://hackage.haskell.org/package/katip
- https://hackage.haskell.org/package/co-log-json
- https://ocaml.org/p/logs/latest/doc/logs/Logs/index.html
- https://tangled.org/gazagnaire.org/ocaml-json-logs/blob/main/README.md
- https://camlworks.github.io/dream/
- https://nim-lang.org/docs/logging.html
- https://github.com/status-im/nim-chronicles
- https://metacpan.org/pod/Log::Any::Adapter::JSON
- https://metacpan.org/pod/Log::Log4perl::Layout::JSON
- https://metacpan.org/pod/Mojo::Log::JSON
- https://nginx.org/en/docs/http/ngx_http_log_module.html
- https://github.com/openresty/lua-nginx-module/issues/1526
- https://pub.dev/packages/logging
- https://github.com/touchlab/Kermit
- docs/plans/20261026072500_ecosystem-research.md
- rfcs/0002-hot-path-performance.md
- rfcs/0003-http-adapters.md
- Agent passes (session): Ruby/JS, Python/Go, JVM/.NET, Rust/Elixir/PHP/mobile, OTel/cloud gaps, Clojure/Scala/Haskell/OCaml/F#/KMP, Julia/R/Lua/Perl/Dart/Nim
