// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal, getOwner, type Owner } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createApp } from '@zenith/runtime-core';
import { uiPlugin, type UIAppHost } from '../src';
const releases: Array<() => void> = [];
function mount(html: string, state: Record<string, unknown> = {}) {
  const root = document.createElement('main'); root.innerHTML = html; document.body.append(root); const app = createApp({ state }); app.use(uiPlugin()); releases.push(() => app.dispose()); return { root, app, start: () => app.mount(root) };
}
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.useRealTimers(); });
it('keeps authored arrows connected while projecting literal text and restores exact authored markup', () => {
  const text = signal('First'), fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#composition-trigger" zen-tooltip-arrow="true"><em>Fallback</em><svg zen-ui-arrow style="color:red;display:inline-block!important"><path d="M0 0L2 2"></path></svg></div>', { text }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, arrow = tooltip.querySelector('svg')!, path = arrow.firstElementChild, before = tooltip.outerHTML; fixture.start();
  expect(tooltip.querySelector('svg')).toBe(arrow); expect(arrow.firstElementChild).toBe(path); expect(arrow.getAttribute('aria-hidden')).toBe('true'); expect(tooltip.textContent).toBe('First'); text.set('<img src=x onerror=alert(1)>'); flushSync(); expect(tooltip.textContent).toBe('<img src=x onerror=alert(1)>'); expect(tooltip.querySelector('img')).toBeNull(); expect(arrow.isConnected).toBe(true); fixture.app.dispose(); expect(tooltip.outerHTML).toBe(before);
});
it('keeps inactive arrows queryable for reactive selection without destroying their geometry styles', () => {
  vi.useFakeTimers(); const text = signal('Tip'), arrow = signal('#composition-arrow-a'); const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#composition-trigger" zen-tooltip-arrow=":$arrow" zen-tooltip-delay="0"><span id="composition-arrow-a" zen-ui-arrow style="color:red"></span><span id="composition-arrow-b" style="color:blue;display:block!important"></span><em>Fallback</em></div>', { text, arrow }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, before = tooltip.outerHTML; fixture.start(); const a = tooltip.querySelector<HTMLElement>('#composition-arrow-a')!, b = tooltip.querySelector<HTMLElement>('#composition-arrow-b')!;
  fixture.root.querySelector('button')!.focus(); vi.advanceTimersByTime(0); expect(a.style.getPropertyValue('--zen-ui-arrow-x')).not.toBe(''); expect(b.hidden).toBe(true); arrow.set('#composition-arrow-b'); flushSync(); expect(a.hidden).toBe(true); expect(b.hidden).toBe(false); expect(b.style.display).toBe('block'); expect(b.style.getPropertyPriority('display')).toBe('important'); expect(b.style.getPropertyValue('--zen-ui-arrow-x')).not.toBe(''); text.set('Next'); flushSync(); expect(b.style.getPropertyValue('--zen-ui-arrow-x')).not.toBe(''); fixture.app.dispose(); expect(tooltip.outerHTML).toBe(before);
});
it('does not bind inactive fallback directives or suppress other root directives', () => {
  const text = signal('Projected'), probe = vi.fn(), rootProbe = vi.fn(); const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="$text" zen-root-probe zen-tooltip-trigger="#composition-trigger"><span zen-probe zen-text="missingCall()">Fallback</span></div>', { text }); fixture.app.directive({ name: 'probe', bind: probe }); fixture.app.directive({ name: 'root-probe', bind: rootProbe }); fixture.start(); expect(probe).not.toHaveBeenCalled(); expect(rootProbe).toHaveBeenCalledTimes(1); expect(fixture.root.querySelector('[zen-tooltip]')!.textContent).toBe('Projected');
});
it('does not take child ownership for an authored tooltip without a text expression', () => {
  const label = signal('Authored'); const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip zen-tooltip-trigger="#composition-trigger"><span zen-text="$label">Fallback</span></div>', { label }); fixture.start(); expect(fixture.root.querySelector('span')!.textContent).toBe('Authored'); label.set('Updated'); flushSync(); expect(fixture.root.querySelector('span')!.textContent).toBe('Updated');
});
it('stops content effects on removal and restores the original text and child identities', async () => {
  const text = signal('First'); const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#composition-trigger"><em>Fallback</em></div>', { text }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, child = tooltip.firstChild; fixture.start(); tooltip.remove(); await Promise.resolve(); await Promise.resolve(); expect(tooltip.firstChild).toBe(child); expect(tooltip.textContent).toBe('Fallback'); const before = tooltip.outerHTML; text.set('Late'); flushSync(); expect(tooltip.outerHTML).toBe(before);
});
it('leaves authored content intact after an initial text-expression failure', () => {
  const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="thrower()" zen-tooltip-trigger="#composition-trigger"><em>Fallback</em><svg zen-ui-arrow></svg></div>', { thrower: () => { throw new Error('text failed'); } }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, before = tooltip.outerHTML; expect(() => fixture.start()).toThrow('text failed'); expect(tooltip.outerHTML).toBe(before); expect(fixture.root.querySelector('button')!.hasAttribute('aria-describedby')).toBe(false);
});
it('ends projection when its trigger is removed, not only when the tooltip node is removed', async () => {
  const text = signal('First'); const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#composition-trigger"><em>Fallback</em><svg zen-ui-arrow></svg></div>', { text }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, before = tooltip.outerHTML; fixture.start(); fixture.root.querySelector('button')!.remove(); await Promise.resolve(); await Promise.resolve(); expect(tooltip.outerHTML).toBe(before); text.set('Late'); flushSync(); expect(tooltip.outerHTML).toBe(before);
});
it('unwinds an App disposed reentrantly by a fallback element presentation callback', () => {
  let release: (() => void) | undefined;
  class ReentrantFallback extends HTMLElement { static get observedAttributes() { return ['hidden']; } attributeChangedCallback() { if (this.hasAttribute('hidden')) release?.(); } }
  if (!customElements.get('zen-reentrant-tooltip-fallback')) customElements.define('zen-reentrant-tooltip-fallback', ReentrantFallback);
  const text = signal('First'); const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#composition-trigger"><zen-reentrant-tooltip-fallback>Fallback</zen-reentrant-tooltip-fallback><svg zen-ui-arrow></svg></div>', { text }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, before = tooltip.outerHTML; release = () => fixture.app.dispose(); fixture.start(); expect(tooltip.outerHTML).toBe(before); text.set('Late'); flushSync(); expect(tooltip.outerHTML).toBe(before); release = undefined;
});

it('requires child-ownership capability for expression content before mutating unsupported hosts', () => {
  let bind: Parameters<UIAppHost['directive']>[0]['bind'] | undefined;
  const plugin = uiPlugin(), release = plugin.install({ directive(definition) { if (definition.name === 'tooltip') bind = definition.bind; return () => {}; } }); releases.push(release);
  const el = document.createElement('div'); el.innerHTML = '<em>Fallback</em>'; const before = el.outerHTML;
  expect(() => bind!(el, { expr: '"Text"', context: {} })).toThrowError(expect.objectContaining({ code: 'ZEN-1603' })); expect(el.outerHTML).toBe(before);
});
it('moves content removal ownership to the replacement trigger without ending a surviving tooltip', async () => {
  const text = signal('First'), trigger = signal('#composition-trigger'); const fixture = mount('<button id="composition-trigger">A</button><button id="composition-next">B</button><div zen-tooltip="$text" zen-tooltip-trigger=":$trigger"><em>Fallback</em></div>', { text, trigger }); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!; fixture.start(); trigger.set('#composition-next'); flushSync(); fixture.root.querySelector('#composition-trigger')!.remove(); await Promise.resolve(); await Promise.resolve(); text.set('Next'); flushSync(); expect(tooltip.textContent).toBe('Next'); fixture.root.querySelector('#composition-next')!.remove(); await Promise.resolve(); await Promise.resolve(); expect(tooltip.textContent).toBe('Fallback'); text.set('Late'); flushSync(); expect(tooltip.textContent).toBe('Fallback');
});

it('keeps an authored arrow ancestor inert and decorative rather than exposing an empty interactive fallback', () => {
  const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="\'Tip\'" zen-tooltip-trigger="#composition-trigger" zen-tooltip-arrow="true"><button tabindex="0" data-fallback>Fallback<svg zen-ui-arrow><path d="M0 0L2 2"></path></svg></button></div>'); const tooltip = fixture.root.querySelector<HTMLElement>('[zen-tooltip]')!, fallback = tooltip.querySelector('button')!, before = tooltip.outerHTML; fixture.start(); expect(fallback.hidden).toBe(false); expect(fallback.hasAttribute('inert')).toBe(true); expect(fallback.getAttribute('aria-hidden')).toBe('true'); expect(fallback.querySelector('svg')!.isConnected).toBe(true); expect(tooltip.textContent).toBe('Tip'); fixture.app.dispose(); expect(tooltip.outerHTML).toBe(before);
});

it('disposes the reactive owner of a text expression that fails during synchronous setup', () => {
  let failedOwner: Owner | null = null;
  const fixture = mount('<button id="composition-trigger">Help</button><div zen-tooltip="thrower()" zen-tooltip-trigger="#composition-trigger"><em>Fallback</em></div>', { thrower: () => { failedOwner = getOwner(); throw new Error('owned expression failed'); } });
  expect(() => fixture.start()).toThrow('owned expression failed'); expect(failedOwner).not.toBeNull(); expect((failedOwner as Owner | null)?.disposed).toBe(true); expect(fixture.root.querySelector('[zen-tooltip]')!.textContent).toBe('Fallback');
});
