import { compileExpression, createBindingContext } from '@zenith/expressions';
import { createReservedError } from '@zenith/errors';
import { createDisposer, type Cleanup } from '@zenith/shared';
import { logger } from '@zenith/logger';
import { Resource } from './resource';
/** Structural subset of Core's BindContext; no lower-layer dependency on Core. @public */
export interface ResourceBindContext {
  expr: string;
  context: Record<string, unknown>;
  state?: Record<string, unknown>;
  processChildren(node: HTMLElement, extraContext?: Record<string, unknown>): Cleanup | void;
  disposes: { add(cleanup: Cleanup): void; isDisposed?(): boolean };
}
/** Bind owned Resource and children through the uniform context contract. @public */
export function processResource(el: HTMLElement, ctx: ResourceBindContext): Cleanup;
/** @deprecated Pass (element, BindContext); positional support is transitional. */
export function processResource(el: HTMLElement, expr: string, context: Record<string, unknown>, processChildren: (node: HTMLElement, context: Record<string, unknown>, disposes: Cleanup[]) => void, disposes: Cleanup[]): Cleanup;
export function processResource(el: HTMLElement, input: string | ResourceBindContext, context?: Record<string, unknown>, legacyChildren?: (node: HTMLElement, context: Record<string, unknown>, disposes: Cleanup[]) => void, legacyDisposes?: Cleanup[]): Cleanup {
  const owned = createDisposer();
  let ctx: ResourceBindContext;
  if (typeof input === 'string') {
    if (!context || !legacyChildren || !legacyDisposes) throw createReservedError('ZEN-1001', { details: { expected: 'Resource BindContext' } });
    const process = legacyChildren; const outer = legacyDisposes;
    ctx = { expr: input, context, disposes: { add: cleanup => { outer.push(cleanup); } }, processChildren(node, extra = {}) {
      const children: Cleanup[] = []; const cleanup = createDisposer();
      try { process(node, extra, children); } finally { for (const release of children) cleanup.add(release); owned.add(cleanup); }
      return cleanup.dispose;
    } };
  } else ctx = input;
  if (ctx.disposes.isDisposed?.()) return () => {};
  try {
    const url: unknown = compileExpression(ctx.expr)(createBindingContext(ctx.state ?? {}, ctx.context));
    if (typeof url !== 'string' || !url.trim()) throw createReservedError('ZEN-1001', { details: { expected: 'a nonempty resource URL string' } });
    const value = new Resource<unknown>({ url }); owned.add(value); ctx.disposes.add(owned.dispose);
    const local = Object.create(ctx.context) as Record<string, unknown>;
    Object.defineProperty(local, `$${el.getAttribute('zen-state') || 'data'}`, { get: () => value.signal.get(), enumerable: true, configurable: true });
    for (const child of Array.from(el.children)) {
      if (owned.isDisposed?.() || ctx.disposes.isDisposed?.()) { owned.dispose(); break; }
      const cleanup = ctx.processChildren(child as HTMLElement, local);
      if (cleanup) { if (owned.isDisposed?.()) cleanup(); else owned.add(cleanup); }
    }
    if (owned.isDisposed?.()) return owned.dispose;
    void value.list().catch(() => { logger.error(createReservedError('ZEN-1001', { details: { expected: 'a successful Resource request' } })); });
    return owned.dispose;
  } catch (error) { try { owned.dispose(); } catch { /* preserve bind failure */ } throw error; }
}
