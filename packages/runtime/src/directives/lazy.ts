import { onGlobalReset } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Cleanup } from '@zenith/shared';

/**
 * Lazy heavy directives (#88).
 *
 * `date-picker` (the whole `@zenith/ui` calendar) and `virtual-repeat` are
 * too heavy for the eager walker entry: every app paid for them whether or
 * not its templates use them. This registry keeps the walker free of static
 * imports of those modules — the dynamic `import()` calls below are the only
 * path that pulls them in, so bundlers place them in independent chunks that
 * are fetched on first discovery of the attribute/tag, never before.
 *
 * Contract:
 * - discovery is synchronous (attribute/tag presence), binding is async;
 *   while loading the element carries `data-zen-lazy="loading"`.
 * - concurrent discoveries share one import (single-flight); a rejected
 *   import is dropped and retried on the next discovery.
 * - an element removed (or disposed by navigation) before the load finishes
 *   is never bound (`data-zen-lazy="cancelled"`).
 * - a bound element carries `data-zen-lazy-bound="<name>"` so hydration and
 *   re-walks never double-bind.
 * - load/processing failures mark `data-zen-lazy="error"` and log — boot
 *   continues, nothing throws out of the walker.
 * - SSR stays synchronous: call `await preloadLazyDirectives()` first, then
 *   the walker takes the cached (sync) path for preloaded names.
 */

/** @public How the walker discovers a lazy directive. */
export interface LazyDirectiveMatch {
  /** Attribute that triggers the load (e.g. `'zen-virtual'`). */
  readonly attribute?: string;
  /** Tag that triggers the load, lowercased (e.g. `'zen-date-picker'`). */
  readonly tag?: string;
}

/** @public Dynamic importer of the module that owns the processor. */
export type LazyDirectiveLoader = () => Promise<Record<string, unknown>>;

/**
 * Invoke the loaded module for one element. Runs after the
 * `isConnected`/disposed guards, so implementations only do the sync
 * processing and return their `Cleanup`.
 *
 * @public
 */
export type LazyDirectiveInvoke = (module: Record<string, unknown>) => Cleanup | void;

/** @public Registration for one lazily-loaded directive. */
export interface LazyDirectiveSpec {
  /** Registry key (e.g. `'zen-virtual'`). */
  readonly name: string;
  readonly match: LazyDirectiveMatch;
  readonly load: LazyDirectiveLoader;
  /** Bundler chunk hint for SSR preload planning (advisory, not a path). */
  readonly chunk?: string;
  /**
   * Module export holding the processor for the generic walker path
   * (e.g. `'processCrud'`). Called as
   * `(el, configAttr, context, state)` where `configAttr` is the matched
   * attribute's value (or `null` for tag matches). Built-ins use dedicated
   * walker branches instead and ignore this field.
   */
  readonly processExport?: string;
}

/** @public SSR manifest row for {@link lazyDirectiveManifest}. */
export interface LazyDirectiveManifestEntry {
  readonly name: string;
  readonly attribute?: string;
  readonly tag?: string;
  readonly chunk?: string;
}

const registry = new Map<string, LazyDirectiveSpec>();
const loadedModules = new Map<string, Record<string, unknown>>();
const pendingLoads = new Map<string, Promise<Record<string, unknown>>>();

function validSpec(spec: LazyDirectiveSpec): boolean {
  if (!spec || typeof spec.name !== 'string' || spec.name.length === 0) {
    logger.warn('[Zenith] registerLazyDirective: name must be a non-empty string.');
    return false;
  }
  if (!spec.match || (typeof spec.match.attribute !== 'string' && typeof spec.match.tag !== 'string')) {
    logger.warn(`[Zenith] registerLazyDirective "${spec.name}": match needs an attribute or a tag.`);
    return false;
  }
  if (typeof spec.load !== 'function') {
    logger.warn(`[Zenith] registerLazyDirective "${spec.name}": load must be a function.`);
    return false;
  }
  return true;
}

/**
 * Register a lazy directive. Overwrites the same name (last wins) and
 * returns an idempotent `Cleanup` that removes only its own registration.
 *
 * @public
 */
export function registerLazyDirective(spec: LazyDirectiveSpec): Cleanup {
  if (!validSpec(spec)) return () => undefined;
  const key = spec.name;
  registry.set(key, spec);
  // #118: uniform registry contract — idempotent Cleanup with identity guard.
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (registry.get(key) === spec) registry.delete(key);
  };
}

/** @public Remove a lazy directive by name; returns whether one existed. */
export function unregisterLazyDirective(name: string): boolean {
  return registry.delete(name);
}

/** @public List the registered lazy directive names. */
export function listLazyDirectives(): string[] {
  return [...registry.keys()].sort();
}

/** @internal Traversal lookup by registry key. */
export function getLazyDirectiveSpec(name: string): LazyDirectiveSpec | undefined {
  return registry.get(name);
}

function registerBuiltIns(): void {
  registry.set('zen-virtual', {
    name: 'zen-virtual',
    match: { attribute: 'zen-virtual' },
    load: () => import('./virtual-repeat'),
    chunk: 'zen-virtual',
  });
  registry.set('zen-date-picker', {
    name: 'zen-date-picker',
    match: { tag: 'zen-date-picker' },
    load: () => import('./date-picker'),
    chunk: '@zenith/ui/date-picker',
  });
}

registerBuiltIns();

/**
 * #118: internal reset without warnings (global reset hook). Drops loaded
 * and pending modules and restores the built-in registrations.
 */
/** Internal reset hook; not part of the root facade. @internal */
export function clearLazyDirectivesInternal(): void {
  registry.clear();
  loadedModules.clear();
  pendingLoads.clear();
  registerBuiltIns();
}

/* @__PURE__ */ onGlobalReset(clearLazyDirectivesInternal);

/**
 * Resolve a directive module with single-flight sharing. A rejection is
 * dropped so the next discovery retries (the bundler caches the chunk
 * request itself, so a retry is cheap).
 *
 * @public
 */
export function ensureLazyProcessor(name: string): Promise<Record<string, unknown>> {
  const cached = loadedModules.get(name);
  if (cached) return Promise.resolve(cached);
  const inflight = pendingLoads.get(name);
  if (inflight) return inflight;
  const spec = registry.get(name);
  if (!spec) return Promise.reject(new Error(`[Zenith] Unknown lazy directive "${name}".`));
  const task = spec.load().then(
    (module) => {
      pendingLoads.delete(name);
      loadedModules.set(name, module);
      return module;
    },
    (error) => {
      pendingLoads.delete(name);
      throw error;
    },
  );
  pendingLoads.set(name, task);
  return task;
}

/** @public Synchronously read a preloaded module (SSR fast path). */
export function getLoadedProcessor(name: string): Record<string, unknown> | undefined {
  return loadedModules.get(name);
}

/**
 * Preload lazy modules (SSR: await before render so the walker binds
 * synchronously; defaults to every registered name).
 *
 * @public
 */
export async function preloadLazyDirectives(names?: readonly string[]): Promise<void> {
  const targets = names ?? [...registry.keys()];
  for (const name of targets) {
    if (!registry.has(name)) throw new Error(`[Zenith] Unknown lazy directive "${name}".`);
  }
  await Promise.all(targets.map((name) => ensureLazyProcessor(name)));
}

/** @public SSR preload planning: name → discovery rule → chunk hint. */
export function lazyDirectiveManifest(): LazyDirectiveManifestEntry[] {
  return [...registry.values()]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((spec) => ({
      name: spec.name,
      ...(spec.match.attribute ? { attribute: spec.match.attribute } : {}),
      ...(spec.match.tag ? { tag: spec.match.tag } : {}),
      ...(spec.chunk ? { chunk: spec.chunk } : {}),
    }));
}

/** @public Whether the element already carries this directive's bind marker. */
export function isLazyBound(el: HTMLElement, name: string): boolean {
  return el.getAttribute('data-zen-lazy-bound') === name;
}

/**
 * Find the first non-built-in spec matching the element. Built-ins
 * (`zen-virtual`, `zen-date-picker`) have dedicated walker branches with
 * their own adapters and never go through the generic path.
 *
 * @internal
 */
export function matchLazyDirective(el: HTMLElement): LazyDirectiveSpec | undefined {
  const tag = el.tagName.toLowerCase();
  for (const spec of registry.values()) {
    if (spec.name === 'zen-virtual' || spec.name === 'zen-date-picker') continue;
    if (spec.match.attribute && el.hasAttribute(spec.match.attribute)) return spec;
    if (spec.match.tag && spec.match.tag === tag) return spec;
  }
  return undefined;
}

function fail(el: HTMLElement, name: string, error: unknown): void {
  el.setAttribute('data-zen-lazy', 'error');
  logger.error(
    `[Zenith] Lazy directive "${name}" failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/**
 * Discover-and-bind one element through the lazy registry. Synchronous when
 * the module is preloaded, otherwise asynchronous with `data-zen-lazy`
 * markers. Never throws: failures mark the element and log.
 *
 * @public
 */
export function processLazyDirective(
  name: string,
  el: HTMLElement,
  disposes: Array<() => void>,
  invoke: LazyDirectiveInvoke,
): void {
  if (!registry.has(name) || isLazyBound(el, name)) return;
  let disposed = false;
  let bound: (() => void) | undefined;
  disposes.push(() => {
    disposed = true;
    bound?.();
  });
  const run = (module: Record<string, unknown>): void => {
    if (disposed || !el.isConnected) {
      el.setAttribute('data-zen-lazy', 'cancelled');
      return;
    }
    try {
      const cleanup = invoke(module);
      if (typeof cleanup === 'function') bound = cleanup;
      el.setAttribute('data-zen-lazy-bound', name);
    } catch (error) {
      fail(el, name, error);
    } finally {
      if (el.getAttribute('data-zen-lazy') === 'loading') el.removeAttribute('data-zen-lazy');
    }
  };
  const cached = loadedModules.get(name);
  if (cached) {
    run(cached);
    return;
  }
  el.setAttribute('data-zen-lazy', 'loading');
  void ensureLazyProcessor(name).then(run, (error: unknown) => fail(el, name, error));
}
