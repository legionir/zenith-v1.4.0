import { createReservedError } from '@zenith/errors';
import { createDisposer, type Disposer } from '@zenith/shared';
import { effect } from '@zenith/state';
import { defineDirective } from '../scope';
import type { DirectiveDefinition } from '../types';
import { createEvalContext, evalExpr } from './shared';
type Row = { node: HTMLElement; disposes: Disposer };
function releaseRows(rows: Iterable<Row>): void {
  const cleanup = createDisposer();
  for (const row of rows) cleanup.add(() => { try { row.disposes.dispose(); } finally { row.node.remove(); } });
  cleanup.dispose();
}
export function buildStructuralDirectives(): DirectiveDefinition[] {
  const zenFor = defineDirective({ name: 'zen-for', priority: 1000, structural: true, bind(el, ctx) {
    const keyExpr = el.getAttribute('zen-key');
    if (!keyExpr?.trim()) throw createReservedError('ZEN-2303', { details: { expr: ctx.expr, element: el.tagName } });
    const parent = el.parentNode; if (!parent) return;
    const match = /^\s*(?:\(\s*([a-zA-Z_$][\w$]*)\s*,\s*([a-zA-Z_$][\w$]*)\s*\)|([a-zA-Z_$][\w$]*))\s+in\s+([\s\S]+)$/.exec(ctx.expr);
    const itemVar = match ? match[1] ?? match[3] ?? '$item' : '$item', indexVar = match?.[2] ?? '$index', listExpr = match ? match[4]!.trim() : ctx.expr;
    const anchor = el.ownerDocument.createComment(`zen-for:${ctx.expr}`); parent.replaceChild(anchor, el);
    const template = el.cloneNode(true) as HTMLElement; template.removeAttribute('zen-for'); template.removeAttribute('zen-key');
    let activeRows = new Map<unknown, Row>(), initialized = false;
    const owned = createDisposer();
    owned.add(() => { const rows = [...activeRows.values()]; activeRows.clear(); for (const row of rows) row.node.remove(); if (anchor.parentNode) anchor.replaceWith(el); releaseRows(rows); });
    // Own rollback before effect's first synchronous evaluation can invoke user binders.
    ctx.disposes.add(owned.dispose);
    try {
      const stop = effect(() => {
        if (owned.isDisposed?.()) return;
        const raw = evalExpr(listExpr, createEvalContext(ctx.state, ctx.context), ctx.app); const list: unknown[] = Array.isArray(raw) ? raw : [];
        const keys = new Set<unknown>();
        const plans = list.map((item, index) => {
          const locals: Record<string, unknown> = { ...ctx.context, [itemVar]: item, [`$${itemVar.replace(/^\$/, '')}`]: item, $item: item, [indexVar]: index, $index: index };
          const key = (keyExpr === '$index' || keyExpr === indexVar ? index : keyExpr === '$item' || keyExpr === itemVar ? item : evalExpr(keyExpr, createEvalContext(ctx.state, locals), ctx.app)) ?? index;
          if (keys.has(key)) throw createReservedError('ZEN-2303', { details: { reason: 'duplicate key', index } });
          keys.add(key); return { key, locals };
        });
        const previous = activeRows, next = new Map<unknown, Row>();
        for (const row of previous.values()) row.node.remove();
        try {
          let reference: Node = anchor;
          for (const plan of plans) {
            if (owned.isDisposed?.()) break;
            const node = template.cloneNode(true) as HTMLElement, disposes = createDisposer(); next.set(plan.key, { node, disposes });
            anchor.parentNode?.insertBefore(node, reference.nextSibling); reference = node;
            const release = ctx.processChildren(node, plan.locals);
            if (owned.isDisposed?.()) release(); else disposes.add(release);
          }
          if (owned.isDisposed?.()) { releaseRows(next.values()); return; }
        } catch (error) {
          try { releaseRows(next.values()); } catch { /* retain bind failure */ }
          if (!owned.isDisposed?.()) { let reference: Node = anchor; for (const row of previous.values()) { anchor.parentNode?.insertBefore(row.node, reference.nextSibling); reference = row.node; } }
          throw error;
        }
        activeRows = next; releaseRows(previous.values());
        if (initialized) ctx.notifyUpdate(); initialized = true;
      });
      if (owned.isDisposed?.()) stop(); else owned.add(stop);
      return owned.dispose;
    } catch (error) { try { owned.dispose(); } catch { /* retain initial bind failure */ } throw error; }
  } });
  const zenIf = defineDirective({ name: 'zen-if', priority: 900, structural: true, bind(el, ctx) {
    const parent = el.parentNode; if (!parent) return;
    const first = el.cloneNode(true) as HTMLElement; first.removeAttribute('zen-if');
    const branches: { expr: string | null; template: HTMLElement }[] = [{ expr: ctx.expr, template: first }];
    const originals: { node: HTMLElement; next: ChildNode | null }[] = [];
    let cursor = el.nextElementSibling as HTMLElement | null;
    while (cursor && (cursor.hasAttribute('zen-else-if') || cursor.hasAttribute('zen-else'))) {
      const isElse = cursor.hasAttribute('zen-else'); const next = cursor.nextElementSibling as HTMLElement | null;
      const template = cursor.cloneNode(true) as HTMLElement; template.removeAttribute(isElse ? 'zen-else' : 'zen-else-if');
      branches.push({ expr: isElse ? null : cursor.getAttribute('zen-else-if') ?? 'false', template }); originals.push({ node: cursor, next: cursor.nextSibling });
      cursor.remove(); if (isElse) break; cursor = next;
    }
    const anchor = el.ownerDocument.createComment(`zen-if:${ctx.expr}`); parent.replaceChild(anchor, el);
    let active: Row | undefined, activeIndex = -1, initialized = false;
    const owned = createDisposer();
    owned.add(() => {
      const previous = active; active = undefined; previous?.node.remove();
      if (anchor.parentNode) {
        for (const original of [...originals].reverse()) anchor.parentNode.insertBefore(original.node, original.next?.parentNode === anchor.parentNode ? original.next : anchor.nextSibling);
        anchor.replaceWith(el);
      }
      if (previous) releaseRows([previous]);
    });
    ctx.disposes.add(owned.dispose);
    try {
      const stop = effect(() => {
        if (owned.isDisposed?.()) return;
        const context = createEvalContext(ctx.state, ctx.context); const index = branches.findIndex(branch => branch.expr === null || Boolean(evalExpr(branch.expr, context, ctx.app)));
        if (index !== activeIndex) {
          const previous = active; let next: Row | undefined; previous?.node.remove();
          try {
            if (index >= 0) { next = { node: branches[index]!.template.cloneNode(true) as HTMLElement, disposes: createDisposer() }; anchor.parentNode?.insertBefore(next.node, anchor.nextSibling); const release = ctx.processChildren(next.node, ctx.context); if (owned.isDisposed?.()) release(); else next.disposes.add(release); }
            if (owned.isDisposed?.()) { if (next) releaseRows([next]); return; }
          } catch (error) { if (next) try { releaseRows([next]); } catch { /* retain bind failure */ } if (!owned.isDisposed?.() && previous) anchor.parentNode?.insertBefore(previous.node, anchor.nextSibling); throw error; }
          active = next; activeIndex = index; if (previous) releaseRows([previous]);
        }
        if (initialized) ctx.notifyUpdate(); initialized = true;
      });
      if (owned.isDisposed?.()) stop(); else owned.add(stop);
      return owned.dispose;
    } catch (error) { try { owned.dispose(); } catch { /* retain initial bind failure */ } throw error; }
  } });
  const zenElseIf = defineDirective({ name: 'zen-else-if', priority: 900, structural: true, bind() {} });
  const zenElse = defineDirective({ name: 'zen-else', priority: 900, structural: true, bind() {} });
  return [zenFor, zenIf, zenElseIf, zenElse];
}
