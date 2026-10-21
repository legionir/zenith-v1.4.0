// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createApp, type BindContext } from '../src';
afterEach(() => { document.body.replaceChildren(); });
it('skips the automatic child walk but still binds same-element siblings and explicitly processed content', () => {
  const app = createApp(), child = vi.fn(), sibling = vi.fn(); let context!: BindContext; app.directive({ name: 'owned', bind(_el, ctx) { context = ctx; ctx.skipChildren?.(); } }); app.directive({ name: 'sibling', bind: sibling }); app.directive({ name: 'child', bind: child }); const root = document.createElement('main'); root.innerHTML = '<section zen-owned zen-sibling><span zen-child></span></section>'; document.body.append(root);
  try { app.mount(root); expect(sibling).toHaveBeenCalledTimes(1); expect(child).not.toHaveBeenCalled(); const release = context.processChildren(root.querySelector('span')!); expect(child).toHaveBeenCalledTimes(1); release(); } finally { app.dispose(); }
});
it('does not retain the decision across mounts or allow processing after owner disposal', () => {
  const app = createApp(), child = vi.fn(); let owned = true, context!: BindContext; app.directive({ name: 'owned', bind(_el, ctx) { context = ctx; if (owned) ctx.skipChildren?.(); } }); app.directive({ name: 'child', bind: child }); const root = document.createElement('main'); root.innerHTML = '<section zen-owned><span zen-child></span></section>'; document.body.append(root);
  const first = app.mount(root); expect(child).not.toHaveBeenCalled(); first(); owned = false; const second = app.mount(root); expect(child).toHaveBeenCalledTimes(1); second(); context.processChildren(root.querySelector('span')!)(); expect(child).toHaveBeenCalledTimes(1); app.dispose();
});
