/** Key/value fields stored in the ambient request context. */
export type ContextFields = Record<string, unknown>;

type Store = {
  context: ContextFields;
  tags: string[];
};

/** Minimal ALS surface used for request/block context (run + getStore only). */
export type AlsInstance<T> = {
  run<R>(store: T, callback: () => R): R;
  getStore(): T | undefined;
};

/** Constructor for {@link AlsInstance}, matching `node:async_hooks`.AsyncLocalStorage. */
export type AlsConstructor = new <T>() => AlsInstance<T>;

const GLOBAL_KEY = "__amkisko_json_logging_als__" as const;

type GlobalAls = typeof globalThis & {
  [GLOBAL_KEY]?: AlsInstance<Store>;
};

let alsOverride: AlsInstance<Store> | null | undefined;
let alsConstructorOverride: AlsConstructor | null | undefined;
/** `false` means not resolved yet; `undefined` means unavailable after resolve. */
let cachedConstructor: AlsConstructor | undefined | false = false;

function isAlsConstructor(value: unknown): value is AlsConstructor {
  return typeof value === "function";
}

function readProcessBuiltin(id: string): unknown {
  const proc = Reflect.get(globalThis, "process");
  if (typeof proc !== "object" || proc === null) {
    return undefined;
  }
  const getBuiltinModule = Reflect.get(proc, "getBuiltinModule");
  if (typeof getBuiltinModule !== "function") {
    return undefined;
  }
  return Reflect.apply(getBuiltinModule, proc, [id]);
}

/**
 * Soft-load AsyncLocalStorage without a static `node:async_hooks` import so browsers
 * and Workers without Node builtins can still import this module for basic logging.
 */
function loadAlsConstructor(): AlsConstructor | undefined {
  if (alsConstructorOverride === null) {
    return undefined;
  }
  if (alsConstructorOverride !== undefined) {
    return alsConstructorOverride;
  }
  if (cachedConstructor !== false) {
    return cachedConstructor;
  }
  for (const id of ["async_hooks", "node:async_hooks"] as const) {
    try {
      const mod = readProcessBuiltin(id);
      if (typeof mod !== "object" || mod === null) {
        continue;
      }
      const ctor: unknown = Reflect.get(mod, "AsyncLocalStorage");
      if (isAlsConstructor(ctor)) {
        cachedConstructor = ctor;
        return cachedConstructor;
      }
    } catch {
      // try next id
    }
  }
  cachedConstructor = undefined;
  return undefined;
}

/** True when this runtime can construct AsyncLocalStorage for ambient context. */
export function isAsyncLocalStorageAvailable(): boolean {
  return loadAlsConstructor() !== undefined;
}

/** Test helper: force ALS constructor resolution (`null` = unavailable). */
export function setAlsConstructorForTests(value: AlsConstructor | null | undefined): void {
  alsConstructorOverride = value;
  cachedConstructor = false;
}

/** Test helper: pass null to simulate a runtime without AsyncLocalStorage. */
export function setAlsOverrideForTests(value: AlsInstance<Store> | null | undefined): void {
  alsOverride = value;
}

function getAls(): AlsInstance<Store> | undefined {
  if (alsOverride === null) {
    return undefined;
  }
  if (alsOverride !== undefined) {
    return alsOverride;
  }
  const Ctor = loadAlsConstructor();
  if (!Ctor) {
    return undefined;
  }
  const globalRef = globalThis as GlobalAls;
  if (!globalRef[GLOBAL_KEY]) {
    globalRef[GLOBAL_KEY] = new Ctor();
  }
  return globalRef[GLOBAL_KEY];
}

export function readStore(als: AlsInstance<Store> | undefined): Store | undefined {
  if (!als) {
    return undefined;
  }
  try {
    return als.getStore();
  } catch {
    return undefined;
  }
}

function currentStore(): Store | undefined {
  return readStore(getAls());
}

/** Copy of the current ambient context fields, or undefined outside a scope. */
export function getContext(): ContextFields | undefined {
  const store = currentStore();
  if (!store) {
    return undefined;
  }
  return { ...store.context };
}

/** Copy of nested `tagged` block tags for the current ALS scope. */
export function getBlockTags(): string[] {
  const store = currentStore();
  if (!store || store.tags.length === 0) {
    return [];
  }
  return [...store.tags];
}

/** One store read for the log hot path. Returns live references; do not mutate. */
export function peekLogStore(): {
  context: ContextFields | undefined;
  tags: readonly string[];
} {
  const store = currentStore();
  if (!store) {
    return { context: undefined, tags: [] };
  }
  return { context: store.context, tags: store.tags };
}

/**
 * Run `fn` with ambient context fields merged for the duration of the call.
 * Without AsyncLocalStorage the callback still runs; context is not retained.
 */
export function withContext<T>(fields: ContextFields, fn: () => T | Promise<T>): T | Promise<T> {
  const als = getAls();
  if (!als) {
    return fn();
  }
  const parent = currentStore();
  const next: Store = {
    context: { ...(parent?.context ?? {}), ...fields },
    tags: parent?.tags ? [...parent.tags] : [],
  };
  return als.run(next, fn);
}

/** Nested tag scope used by {@link Logger.tagged} block form. */
export function withBlockTags<T>(
  tags: readonly string[],
  fn: () => T | Promise<T>
): T | Promise<T> {
  const als = getAls();
  if (!als) {
    return fn();
  }
  const parent = currentStore();
  const next: Store = {
    context: parent?.context ? { ...parent.context } : {},
    tags: [...(parent?.tags ?? []), ...tags],
  };
  return als.run(next, fn);
}

/** Test helper: clear the global ALS singleton between suites. */
export function resetContextStorageForTests(): void {
  const globalRef = globalThis as GlobalAls;
  const Ctor = loadAlsConstructor();
  if (Ctor) {
    globalRef[GLOBAL_KEY] = new Ctor();
  } else {
    delete globalRef[GLOBAL_KEY];
  }
  alsOverride = undefined;
}
