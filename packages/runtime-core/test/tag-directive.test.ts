// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createApp, type BindContext } from '../src';
afterEach(() => { document.body.replaceChildren(); });
it('matches only opt-in exact tags and binds a definition once despite aliases/attributes', () => {
  const el = document.createElement('main'); el.innerHTML = '<zen-widget></zen-widget><zen-widget zen-widget="explicit"></zen-widget><zen-other></zen-other>'; document.body.append(el);
  const app = createApp(), release = vi.fn(), bind = vi.fn((_el: HTMLElement, _context: BindContext) => release);
  app.directive({ name: 'widget', tag: 'zen-widget', bind });
  const stop = app.mount(el); expect(bind).toHaveBeenCalledTimes(2); expect(bind.mock.calls[0]![1].expr).toBe(''); expect(bind.mock.calls[1]![1].expr).toBe('explicit'); stop(); expect(release).toHaveBeenCalledTimes(2); app.dispose(); expect(release).toHaveBeenCalledTimes(2);
});
it('does not infer a custom tag match from a directive name without opting in', () => {
  const el = document.createElement('main'); el.innerHTML = '<zen-widget></zen-widget>'; const app = createApp(), bind = vi.fn(); app.directive({ name: 'widget', bind }); app.mount(el); expect(bind).not.toHaveBeenCalled(); app.dispose();
});

it('invalidates the tag index on replacement/unregister without retaining a removed definition', () => {
  const app = createApp(), first = vi.fn(), second = vi.fn();
  const old = app.directive({ name: 'widget', tag: 'zen-widget', bind: first });
  const mount = () => { const root = document.createElement('main'); root.innerHTML = '<zen-widget></zen-widget>'; return app.mount(root); };
  mount()(); const current = app.directive({ name: 'widget', tag: 'zen-widget', bind: second }); old(); mount()();
  expect(first).toHaveBeenCalledTimes(1); expect(second).toHaveBeenCalledTimes(1); current(); mount()(); expect(second).toHaveBeenCalledTimes(1); app.dispose();
});
