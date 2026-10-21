import { compileExpression, createBindingContext } from '@zenith/expressions';
import { untrack } from '@zenith/state';
import { createDisposer, type Cleanup } from '@zenith/shared';
import { s, validate, type Schema, type DirectiveMeta } from '@zenith/schema';
import { createFocusTrap, createRovingTabindex } from './focus';
import { announce } from './announce';
import { inert, lockScroll, prefersReducedMotion } from './environment';
import { bindingScope } from './binding';
/** @public */
export interface A11yBindContext { expr: string; evaluate?(): unknown; context: Record<string, unknown>; state?: Record<string, unknown>; }
/** Structural host; no dependency on the runtime layer. @public */
export interface A11yAppHost { directive(definition: { name: string; meta?: DirectiveMeta; bind(el: HTMLElement, context: A11yBindContext): Cleanup }): Cleanup; }
const boolean = s.boolean(), politeness = s.enum(['polite', 'assertive', 'off']), duration = s.duration({ min: 0, max: 2147483647 });
const definitions: Array<[string, string, string[]]> = [
  ['focus-trap', 'Reactive owned focus trap.', ['initial', 'return', 'escape']], ['autofocus', 'Focus when a boolean expression becomes true.', []],
  ['inert', 'Reactive owned inert lease.', []], ['scroll-lock', 'Reactive counted scroll lock.', []],
  ['roving', 'Keyboard roving tab stops with owned restoration.', ['loop', 'selector']], ['live', 'Owned role, politeness and atomic live-region attributes.', []],
  ['announce', 'Text-only reactive live announcement.', ['politeness', 'clear']], ['reduced-motion', 'Owned reduced-motion preference.', []],
];
const metas: ReadonlyMap<string, DirectiveMeta> = new Map(definitions.map(([name, description, fields]) => [name, { name: `zen-${name}`, description, attributes: fields.map(field => `zen-${name}-${field}`) }]));
function attribute<T>(el: HTMLElement, name: string, schema: Schema<T>, fallback: T): T {
  const raw = el.getAttribute(name); return raw === null ? fallback : validate(schema, raw === '' && schema.kind === 'boolean' ? true : raw, { name, mode: 'throw', coerce: true });
}
function reader(context: A11yBindContext): () => unknown {
  if (context.evaluate) return () => context.evaluate!();
  const read = compileExpression(context.expr), view = createBindingContext(context.state ?? {}, context.context); return () => read(view);
}
function condition(el: HTMLElement, context: A11yBindContext, owner: ReturnType<typeof bindingScope>, acquire: () => Cleanup) {
  const read = context.expr.trim() ? reader(context) : () => true; let previous: boolean | undefined, release: Cleanup = () => {};
  owner.add(() => release());
  owner.effect(() => {
    const next = validate(boolean, read(), { name: el.localName, mode: 'throw', coerce: true });
    untrack(() => {
      if (next === previous || owner.disposed) return; previous = next;
      const old = release; release = () => {}; old();
      if (next && !owner.disposed) { const cleanup = acquire(); if (owner.disposed) cleanup(); else release = cleanup; }
    });
  });
}
/** Client-only attributes; every binding/effect belongs to its App and element. @public */
export function a11yPlugin() {
  return { name: 'zenith:a11y', install(app: A11yAppHost): Cleanup {
    const owned = createDisposer(), bindings = new Set<Cleanup>(); let disposed = false;
    const register = (name: string, bind: (el: HTMLElement, context: A11yBindContext, owner: ReturnType<typeof bindingScope>) => void) => owned.add(app.directive({ name, meta: metas.get(name), bind(el, context) {
      if (disposed || !el.ownerDocument.defaultView || (el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
      const owner = bindingScope(el);
      try { bind(el, context, owner); } catch (error) { try { owner.dispose(); } catch {} throw error; }
      if (disposed) { owner.dispose(); return () => {}; }
      let active = true; const cleanup = () => { if (!active) return; active = false; bindings.delete(cleanup); owner.dispose(); };
      bindings.add(cleanup); owner.add(() => bindings.delete(cleanup)); return cleanup;
    } }));
    const dispose = () => { if (disposed) return; disposed = true; for (const cleanup of bindings) owned.add(cleanup); bindings.clear(); owned.dispose(); };
    try {
      register('focus-trap', (el, ctx, owner) => {
        const initialFocus = el.getAttribute('zen-focus-trap-initial'), returnFocus = attribute(el, 'zen-focus-trap-return', boolean, true), escapeDeactivates = attribute(el, 'zen-focus-trap-escape', boolean, true);
        condition(el, ctx, owner, () => { const trap = createFocusTrap(el, { initialFocus, returnFocus, escapeDeactivates }); try { trap.activate(); } catch (error) { trap.dispose(); throw error; } return () => trap.dispose(); });
      });
      register('autofocus', (el, ctx, owner) => condition(el, ctx, owner, () => { el.focus(); return () => {}; }));
      register('inert', (el, ctx, owner) => condition(el, ctx, owner, () => inert(el)));
      register('scroll-lock', (el, ctx, owner) => condition(el, ctx, owner, () => lockScroll(el.ownerDocument)));
      register('roving', (el, _ctx, owner) => owner.add(createRovingTabindex(el, { orientation: attribute(el, 'zen-roving', s.enum(['horizontal', 'vertical', 'both']), 'horizontal'), loop: attribute(el, 'zen-roving-loop', boolean, true), selector: el.getAttribute('zen-roving-selector') ?? undefined })));
      register('live', (el, _ctx, owner) => { const value = attribute(el, 'zen-live', politeness, 'polite'); owner.attr('role', value === 'assertive' ? 'alert' : 'status'); owner.attr('aria-live', value); owner.attr('aria-atomic', 'true'); });
      register('announce', (el, context, owner) => {
        const read = reader(context), mode = attribute(el, 'zen-announce-politeness', politeness, 'polite'), clearAfter = attribute(el, 'zen-announce-clear', duration, 5000); let clear: Cleanup = () => {};
        owner.add(() => clear());
        owner.effect(() => { const message = String(read() ?? ''); untrack(() => { clear(); clear = () => {}; if (!owner.disposed) { const release = announce(message, { doc: el.ownerDocument, politeness: mode, clearAfter }); if (owner.disposed) release(); else clear = release; } }); });
      });
      register('reduced-motion', (el, _ctx, owner) => { const value = attribute(el, 'zen-reduced-motion', s.enum(['skip', 'fade']), 'skip'), pref = prefersReducedMotion(el.ownerDocument); owner.add(pref); owner.effect(() => owner.attr('data-reduced-motion', pref.get() ? value : 'none')); });
      return dispose;
    } catch (error) { try { dispose(); } catch {} throw error; }
  } };
}
