# RFC 0005: Redact keys and censor modes, injectable context storage

- Type: Standards Track
- Status: Experimental
- Created: 2026-10-28
- Author: maintainers
- Relates: RFC-0002
- Requires: RFC-0002

## Summary

Extend `LoggerOptions.redact` to accept paths, key names, and censor modes (`filtered`, `remove`, `hash`, or a function). Add `configureContextStorage` so hosts can inject AsyncLocalStorage when Node builtins are not soft-loadable. Keep `README.md` as the single operational API map (no parallel agent summary file).

## Motivation

RFC-0002 left `{ paths, censor }` unresolved. Apps need key-name redaction and remove/hash censors without a second package. Workers that import `AsyncLocalStorage` from `node:async_hooks` still need ambient `withContext` when soft-load fails.

## Guide-level explanation

```ts
import {
  configureContextStorage,
  createLogger,
  withContext,
} from "@amkisko/json-logging";
import { AsyncLocalStorage } from "node:async_hooks";

configureContextStorage(new AsyncLocalStorage());

const logger = createLogger({
  redact: {
    paths: ["user.password", "*.token"],
    keys: ["ssn", "apiKey"],
    caseInsensitive: true,
    censor: "hash",
    hashLabel: "hash",
  },
});

await withContext({ requestId: "abc" }, async () => {
  logger.info({ user: { password: "secret", name: "Ada" }, ssn: "123" });
});
```

Array form `redact: ["user.password"]` keeps RFC-0002 behavior (`"[FILTERED]"`).

## Reference-level explanation

### redact

`LoggerOptions.redact` is `readonly string[]` or `RedactOptions`:

- `paths`: same dot paths and `*` segment as RFC-0002
- `keys`: match object key names anywhere in the record tree after serializers
- `caseInsensitive`: when true, key matching ignores case (default false)
- `censor`: `"filtered"` (default, write `"[FILTERED]"`), `"remove"` (drop object keys; array slots become `null`), `"hash"` (non-cryptographic correlation token `[label:hex8]`), or `(value) => unknown`
- `hashLabel`: label inside hash tokens (default `"hash"`)

Apply paths first, then key matches. Config-time only; invalid paths ignored. Built-in sensitive-key filtering in sanitize stays independent and always uses `"[FILTERED]"`.

### configureContextStorage

`configureContextStorage(storage)` sets the ALS instance used by `withContext`, block `tagged`, and `peekLogStore`. `configureContextStorage(null)` clears the injection and restores soft-load. When an instance is set, `isAsyncLocalStorageAvailable()` is true. Test helpers remain for forcing unavailable ALS.

### Documentation

`README.md` is the operational contract for humans and agents. Do not ship a second package-root summary that duplicates it.

## Security considerations

Redact paths and keys MUST NOT come from request input. Hash censor is for correlation only, not integrity or secrecy. Injected ALS is host-owned; the package does not validate Workers compat flags.

## Registrar

- `LoggerOptions.redact` union with `RedactOptions`
- `RedactOptions`, `RedactCensor`
- `compileRedact`, `applyCompiledRedact`
- `configureContextStorage`
- `ContextStore`

## Drawbacks

More options on the hot path when keys or hash are configured. Injected ALS can diverge from soft-load singleton if misused.

## Rationale and alternatives

Keep a single redact option rather than parallel `redactKeys` / `redactCensor` fields. Soft-load stays default; injection is opt-in for Workers. Reject a parallel `llms.txt`: the README already has to be slim enough for successful operations. Reject shipping pretty/mask middleware stacks.

## Prior art

Path redaction (RFC-0002). Soft-load ALS via `process.getBuiltinModule`.

## Unresolved questions

- Whether default sensitive-key sanitize should honor the logger censor mode.
- Whether `hash` should stabilize across BigInt and circular values beyond `JSON.stringify` fallback.

## Future possibilities

Regex value censor. Middleware drop pipeline.
