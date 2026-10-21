// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createDialog, createPopover, createTooltip, createMenu } from '../src';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); Reflect.deleteProperty(document, '__zenithSSR__'); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('rejects invalid duration/portal/focus configuration before changing authored DOM', () => {
  const el = root('<h2 zen-dialog-title>Title</h2><button>Inside</button>'), before = el.outerHTML;
  expect(() => createDialog(el, { transitionDuration: -1 })).toThrow(); expect(el.outerHTML).toBe(before);
  expect(() => createDialog(el, { portal: '[' })).toThrowError(expect.objectContaining({ code: 'ZEN-1604' })); expect(el.outerHTML).toBe(before);
  expect(() => createDialog(el, { initialFocus: '#absent' })).toThrowError(expect.objectContaining({ code: 'ZEN-1601' })); expect(el.outerHTML).toBe(before);
});
it('rejects foreign anchors/arrows and invalid tooltip delays without acquiring trigger ARIA', () => {
  const anchor = root('<button>Anchor</button>').querySelector('button')!, el = root('Contents'), foreign = document.implementation.createHTMLDocument().createElement('button'), before = el.outerHTML;
  expect(() => createPopover(el, { trigger: foreign })).toThrowError(expect.objectContaining({ code: 'ZEN-1601' }));
  expect(() => createPopover(el, { trigger: anchor, arrow: el })).toThrowError(expect.objectContaining({ code: 'ZEN-1601' }));
  expect(() => createPopover(el, { trigger: anchor, arrow: foreign })).toThrowError(expect.objectContaining({ code: 'ZEN-1601' }));
  expect(() => createTooltip(el, { trigger: anchor, hideDelay: -1 })).toThrow(); expect(el.outerHTML).toBe(before); expect(anchor.hasAttribute('aria-expanded')).toBe(false); expect(anchor.hasAttribute('aria-describedby')).toBe(false);
});
it('does not acquire browser motion/geometry or open a client-only floating surface in explicit SSR mode', () => {
  Object.defineProperty(document, '__zenithSSR__', { configurable: true, value: true }); const media = vi.fn(); vi.stubGlobal('matchMedia', media); const anchor = root('<button>Anchor</button>').querySelector('button')!, el = root('Contents'), rect = vi.spyOn(anchor, 'getBoundingClientRect');
  const controller = createPopover(el, { trigger: anchor, transition: 'fade' }); releases.push(controller.dispose); controller.open(); anchor.click(); expect(controller.state.peek()).toBe(false); expect(el.hidden).toBe(true); expect(media).not.toHaveBeenCalled(); expect(rect).not.toHaveBeenCalled();
});
it('does not resurrect a dialog disposed by a custom-element reconnect during reactive portal movement', () => {
  let controller: ReturnType<typeof createDialog> | undefined;
  class ReentrantDialog extends HTMLElement { connectedCallback() { if (this.parentElement?.id === 'reentrant-destination') controller?.dispose(); } }
  if (!customElements.get('zen-reentrant-surface-move')) customElements.define('zen-reentrant-surface-move', ReentrantDialog);
  const source = root(), a = root(), b = root(); b.id = 'reentrant-destination'; const el = document.createElement('zen-reentrant-surface-move'); el.innerHTML = '<h2 zen-dialog-title>Move</h2><button>Inside</button>'; source.append(el); const before = el.outerHTML, destination = signal<HTMLElement | false>(a);
  controller = createDialog(el, { portal: destination }); releases.push(controller.dispose); controller.open(); destination.set(b); flushSync(); expect(controller.state.peek()).toBe(false); expect(el.parentElement).toBe(source); expect(el.outerHTML).toBe(before); controller.open(); expect(el.outerHTML).toBe(before); expect(document.body.style.overflow).not.toBe('hidden');
});

it('rejects a misleading role on fixed-role Menu and Tooltip before creating surface ownership', () => {
  const trigger = root('<button>Trigger</button>').querySelector('button')!, el = root('<button zen-menu-item>Item</button>'), before = el.outerHTML;
  expect(() => Reflect.apply(createMenu, undefined, [el, { trigger, role: 'dialog' }])).toThrow(); expect(() => Reflect.apply(createTooltip, undefined, [el, { trigger, role: 'dialog' }])).toThrow(); expect(el.outerHTML).toBe(before); expect(trigger.hasAttribute('aria-controls')).toBe(false); expect(trigger.hasAttribute('aria-describedby')).toBe(false);
});
