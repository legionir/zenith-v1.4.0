import { compileExpression, createBindingContext } from '@zenith/expressions';
import { createDisposer, type Cleanup } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
import type { DirectiveMeta } from '@zenith/schema';
import type { HeadInput, HeadManager, HeadScript } from './index';
/** @public */
export interface HeadBindContext { expr: string; evaluate?(): unknown; context: Record<string, unknown>; state?: Record<string, unknown>; skipChildren?(): void; }
/** @public */
export interface HeadAppHost { provide(key: string | symbol, value: unknown): unknown; directive(definition: { name: string; tag?: string; meta?: DirectiveMeta; bind(el: HTMLElement, context: HeadBindContext): Cleanup }): Cleanup; }
function authored(el: HTMLElement): HeadInput {
  const value: HeadInput = {}, meta: Array<Record<string, string>> = [], link: Array<Record<string, string>> = [], scripts: HeadScript[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 8 || node.nodeType === 3 && !node.textContent?.trim()) continue;
    if (node.nodeType !== 1) throw createReservedError('ZEN-1501');
    const child = node as HTMLElement;
    const attrs = Object.fromEntries(Array.from(child.attributes, attr => [attr.name === 'zen-head-key' ? 'key' : attr.name, attr.value]));
    switch (child.localName) {
      case 'title': value.title = child.textContent ?? ''; break;
      case 'meta': meta.push(attrs); break;
      case 'link': link.push(attrs); break;
      case 'base': value.base = attrs; break;
      case 'script': {
        if (child.getAttribute('type') !== 'application/ld+json' || child.hasAttribute('src')) throw createReservedError('ZEN-1501');
        scripts.push({ type: 'application/ld+json', key: attrs.key, innerHTML: child.textContent ?? '' }); break;
      }
      default: throw createReservedError('ZEN-1501');
    }
  }
  value.meta = meta; value.link = link; if (scripts.length) value.script = scripts; return value;
}
export function installHeadPlugin(app: HeadAppHost, head: HeadManager): Cleanup {
  const owned = createDisposer(), active = new Set<Cleanup>(); let disposed = false;
  const add = (cleanup: Cleanup) => { if (disposed) cleanup(); else owned.add(cleanup); };
  const register = (name: string, description: string, bind: (el: HTMLElement, context: HeadBindContext) => Cleanup, tag?: string) => {
    add(app.directive({ name, tag, meta: { name: `zen-${name}`, description, attributes: ['zen-head-key'] }, bind(el, context) {
      if (disposed) return () => {};
      const cleanup = bind(el, context); if (disposed) { cleanup(); return () => {}; }
      let alive = true, observer: MutationObserver | undefined, connected = el.isConnected;
      const release = () => { if (!alive) return; alive = false; active.delete(release); observer?.disconnect(); cleanup(); };
      const Observer = el.ownerDocument.defaultView?.MutationObserver;
      if (Observer) { observer = new Observer(() => { if (el.isConnected) connected = true; else if (connected) release(); }); observer.observe(el.ownerDocument, { childList: true, subtree: true }); }
      active.add(release); return release;
    } }));
  };
  const dispose = () => { if (disposed) return; disposed = true; for (const release of active) owned.add(release); active.clear(); try { owned.dispose(); } finally { head.dispose(); } };
  try {
    app.provide('zenith:head', head);
    const definitions: Array<[string, (value: string, key?: string) => HeadInput]> = [
      ['head-title', value => ({ title: value })], ['head-description', (value, key) => ({ meta: [{ name: 'description', content: value, ...(key ? { key } : {}) }] })],
      ['head-canonical', (value, key) => ({ link: [{ rel: 'canonical', href: value, ...(key ? { key } : {}) }] })], ['head-og-image', (value, key) => ({ meta: [{ property: 'og:image', content: value, ...(key ? { key } : {}) }] })],
    ];
    for (const [name, convert] of definitions) register(name, `Reactive ${name.slice(5)} head entry.`, (el, context) => {
      const key = el.getAttribute('zen-head-key') ?? undefined;
      const read = context.evaluate ? () => context.evaluate!() : (() => { const compiled = compileExpression(context.expr), view = createBindingContext(context.state ?? {}, context.context); return () => compiled(view); })();
      const entry = head.push(() => convert(String(read() ?? ''), key)); return () => entry.dispose();
    });
    register('head', 'Owned authored title/meta/link/base/JSON-LD head content.', (el, context) => {
      if (context.expr.trim() || !context.skipChildren) throw createReservedError('ZEN-1501');
      const value = authored(el), nodes = Array.from(el.childNodes), entry = head.push(value); let alive = true;
      context.skipChildren();
      try { for (const node of nodes) node.remove(); }
      catch (error) { entry.dispose(); for (const node of nodes) el.append(node); throw error; }
      return () => { if (!alive) return; alive = false; try { entry.dispose(); } finally { for (const node of nodes) el.append(node); } };
    }, 'zen-head');
    return dispose;
  } catch (error) { try { dispose(); } catch {} throw error; }
}
